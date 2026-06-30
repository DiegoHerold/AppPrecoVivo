'use client'

import { useState } from 'react'
import { Camera, ChevronRight, FileText, Image as ImageIcon, Keyboard, Link2, PackagePlus, Upload } from 'lucide-react'
import { clientApi, localDate } from '@/lib/client-api'
import type { AppScreen } from '@/lib/client-types'
import { prepareBackendQrFallback, readQrCodeFromImage } from '@/lib/client-qr'
import { CameraCapture } from './camera-capture'
import { PageHeader, PrimaryButton } from './ui'

type Mode = 'camera' | 'options' | 'key' | 'url' | 'file'
type InputType = 'access_key' | 'nfce_url' | 'qr_code_url'
type ImportResponse = {
  id: string | null
  jobId?: string
  imported: boolean
  duplicate: boolean
  itemCount: number
  message: string
  errorCode?: string
  detectedAccessKey?: string
  importJobs: { status: string; errorMessage: string | null }[]
}

export function AddNoteScreen({ navigate, onBack, cameraFacingMode, created }: {
  navigate: (screen: AppScreen) => void
  onBack: () => void
  cameraFacingMode: 'environment' | 'user'
  created: (id: string) => void
}) {
  const [mode, setMode] = useState<Mode>('camera')
  const [input, setInput] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [message, setMessage] = useState('')
  const [lastResult, setLastResult] = useState<ImportResponse | null>(null)
  const [saving, setSaving] = useState(false)

  function handleResult(result: ImportResponse) {
    setLastResult(result)
    setMessage(result.message)
    if (result.imported && result.id) created(result.id)
  }

  function changeMode(next: Mode, value = '') {
    setMode(next)
    setInput(value)
    setMessage('')
    setLastResult(null)
  }

  async function decodeWithBackendFallback(selectedFile: File) {
    try {
      return await readQrCodeFromImage(selectedFile)
    } catch {
      const temporaryFile = await prepareBackendQrFallback(selectedFile)
      const form = new FormData()
      form.append('file', temporaryFile)
      return (await clientApi<{ decodedText: string }>('/api/uploads', {
        method: 'POST',
        body: form,
      })).decodedText
    }
  }

  async function importPhoto(selectedFile: File) {
    const decodedText = await decodeWithBackendFallback(selectedFile)
    const inputType: InputType = /^\d{44}$/.test(decodedText.trim()) ? 'access_key' : 'qr_code_url'
    return persistPending(inputType, decodedText)
  }

  async function persistPending(inputType: InputType, inputValue = input) {
    return clientApi<ImportResponse>('/api/import-jobs', {
      method: 'POST',
      body: JSON.stringify({ inputType, inputValue, purchaseDate: localDate() }),
    })
  }

  async function createPending() {
    setSaving(true)
    try {
      if (mode === 'file' && file) {
        const result = await importPhoto(file)
        handleResult(result)
      } else {
        const result = await persistPending(mode === 'key' ? 'access_key' : 'nfce_url')
        handleResult(result)
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Não foi possível criar a tarefa.')
    } finally {
      setSaving(false)
    }
  }

  async function submitPhoto(photo: File) {
    const result = await importPhoto(photo)
    if (result.imported && result.id) created(result.id)
    else { setMode('file'); setFile(null); handleResult(result) }
    return result.message
  }

  if (mode === 'camera') {
    return <CameraCapture
      initialFacingMode={cameraFacingMode}
      onBack={onBack}
      chooseFile={() => changeMode('file')}
      submitPhoto={submitPhoto}
      openManual={() => navigate('manual')}
      openKey={() => changeMode('key')}
      openOptions={() => changeMode('options')}
    />
  }

  if (mode === 'options') {
    const options = [
      { action: () => changeMode('key'), label: 'Digitar chave', detail: 'Informe os 44 dígitos da NFC-e.', icon: Keyboard, tone: 'bg-indigo-50 text-indigo-700' },
      { action: () => changeMode('file'), label: 'Escolher foto', detail: 'O QR Code é lido no próprio aparelho.', icon: Upload, tone: 'bg-cyan-50 text-cyan-700' },
      { action: () => changeMode('url'), label: 'Colar URL da NFC-e', detail: 'Cole o endereço do portal da nota.', icon: Link2, tone: 'bg-violet-50 text-violet-700' },
      { action: () => navigate('text'), label: 'Colar lista de produtos', detail: 'Uma linha para cada item comprado.', icon: FileText, tone: 'bg-amber-50 text-amber-700' },
      { action: () => navigate('manual'), label: 'Cadastrar compra manualmente', detail: 'Informe estabelecimento, produtos e preços.', icon: PackagePlus, tone: 'bg-emerald-50 text-emerald-700' },
    ]
    return <div className="px-4 pb-8 md:px-6">
      <PageHeader title="Adicionar compra" subtitle="Escolha a forma mais prática agora" onBack={onBack} />
      <button onClick={() => changeMode('camera')} className="mt-5 flex min-h-24 w-full items-center gap-4 rounded-3xl bg-[linear-gradient(145deg,#3730A3,#635BFF)] p-5 text-left text-white shadow-[0_10px_28px_rgba(67,56,202,.24)]">
        <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-white/15"><Camera size={27} /></span>
        <span className="min-w-0 flex-1"><strong className="block text-xl">Abrir câmera</strong><small className="mt-1 block text-sm leading-5 text-white/75">Aproxime e fotografe o QR Code da nota.</small></span>
        <ChevronRight size={22} />
      </button>
      <section className="mt-7"><h2 className="text-xl font-bold tracking-tight text-slate-950">Outras formas de adicionar</h2><p className="mt-1 text-sm leading-6 text-slate-600">Use estas opções quando não puder fotografar a nota.</p>
        <div className="mt-4 grid gap-3">{options.map((option) => { const Icon = option.icon; return <button key={option.label} onClick={option.action} className="flex min-h-20 w-full items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm active:scale-[.99]"><span className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${option.tone}`}><Icon size={21} /></span><span className="min-w-0 flex-1"><strong className="block text-base text-slate-950">{option.label}</strong><small className="mt-1 block text-sm leading-5 text-slate-600">{option.detail}</small></span><ChevronRight className="shrink-0 text-slate-400" size={20} /></button> })}</div>
      </section>
    </div>
  }

  return <div className="px-4 pb-8">
    <PageHeader title={mode === 'key' ? 'Digitar chave' : mode === 'url' ? 'Colar URL da NFC-e' : 'Escolher foto'} subtitle="Consulta oficial e importação dos itens" onBack={() => changeMode('options')} />
    <div className="mb-4 rounded-xl bg-emerald-50 p-3 text-[9px] leading-4 text-emerald-800"><strong>Importação real da NFC-e.</strong><p>O QR Code ou a chave é validado e consultado no portal oficial. Nada é inventado quando a consulta não responde.</p></div>
    {mode === 'key' && <label className="form-label">Chave de acesso<input value={input} onChange={(event) => { setInput(event.target.value.replace(/\D/g, '').slice(0, 44)); setMessage(''); setLastResult(null) }} className="form-input" inputMode="numeric" placeholder="44 dígitos" /><small className="text-right text-[8px] text-slate-400">{input.length}/44</small></label>}
    {mode === 'url' && <label className="form-label">URL da nota<input value={input} onChange={(event) => { setInput(event.target.value); setMessage(''); setLastResult(null) }} className="form-input" type="url" placeholder="https://…" /></label>}
    {mode === 'file' && <label className="grid min-h-44 cursor-pointer place-content-center justify-items-center gap-2 rounded-2xl border-2 border-dashed border-indigo-200 bg-indigo-50 text-center text-indigo-600"><ImageIcon size={28} /><strong className="text-xs">Escolher foto do QR Code</strong><span className="text-[9px] text-slate-400">{file?.name || 'JPG, PNG ou WEBP · a foto não será salva'}</span><input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(event) => { setFile(event.target.files?.[0] ?? null); setMessage(''); setLastResult(null) }} /></label>}
    {message && <div role="status" className={'mt-4 rounded-xl p-3 text-[9px] leading-4 ' + (lastResult?.duplicate ? 'bg-amber-50 text-amber-800' : 'bg-rose-50 text-rose-700')}><strong className="block">{lastResult?.duplicate ? 'Nota já importada' : 'Não foi possível importar automaticamente'}</strong><p className="mt-1">{message}</p><div className="mt-3 flex flex-wrap gap-2">{lastResult?.duplicate && lastResult.id && <button onClick={() => created(lastResult.id as string)} className="rounded-lg bg-amber-100 px-2.5 py-2 font-bold">Abrir compra existente</button>}{mode === 'file' && <button onClick={() => { setFile(null); setMessage(''); setLastResult(null) }} className="rounded-lg bg-white px-2.5 py-2 font-bold shadow-sm">Tentar outra foto</button>}<button onClick={() => changeMode('key', lastResult?.detectedAccessKey ?? '')} className="rounded-lg bg-white px-2.5 py-2 font-bold shadow-sm">Digitar chave</button><button onClick={() => navigate('manual')} className="rounded-lg bg-white px-2.5 py-2 font-bold shadow-sm">Cadastrar manualmente</button></div></div>}
    <PrimaryButton className="mt-5" onClick={createPending} disabled={saving || (mode === 'key' ? input.length !== 44 : mode === 'file' ? !file : !input)}>{saving ? 'Lendo e consultando a SEFAZ…' : 'Identificar e importar nota'}</PrimaryButton>
    <div className="my-5 flex items-center gap-3 text-[8px] text-slate-300"><span className="h-px flex-1 bg-slate-200" />ou registre agora<span className="h-px flex-1 bg-slate-200" /></div>
    <div className="grid grid-cols-2 gap-2"><button onClick={() => navigate('text')} className="rounded-xl border border-slate-200 bg-white p-3 text-left"><FileText size={18} className="text-indigo-500" /><strong className="mt-2 block text-[10px]">Colar texto</strong><small className="text-[8px] text-slate-400">Uma linha por item</small></button><button onClick={() => navigate('manual')} className="rounded-xl border border-slate-200 bg-white p-3 text-left"><Camera size={18} className="text-emerald-500" /><strong className="mt-2 block text-[10px]">Cadastro manual</strong><small className="text-[8px] text-slate-400">Compra e itens</small></button></div>
  </div>
}
