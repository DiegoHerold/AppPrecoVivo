'use client'

import { useState } from 'react'
import { Camera, FileText, Image as ImageIcon, Keyboard, Link2, QrCode, Upload, X, Zap } from 'lucide-react'
import { clientApi, localDate } from '@/lib/client-api'
import type { AppScreen } from '@/lib/client-types'
import { CameraCapture } from './camera-capture'
import { PageHeader, PrimaryButton } from './ui'

type Mode = 'scan' | 'camera' | 'key' | 'url' | 'file'
type InputType = 'image' | 'pdf' | 'access_key' | 'nfce_url'
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
  const [mode, setMode] = useState<Mode>('scan')
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

  async function uploadFile(selectedFile: File) {
    const form = new FormData()
    form.append('file', selectedFile)
    return (await clientApi<{ upload: { id: string; url: string; originalName: string } }>('/api/uploads', {
      method: 'POST',
      body: form,
    })).upload
  }

  async function persistPending(inputType: InputType, fileUrl?: string) {
    return clientApi<ImportResponse>('/api/import-jobs', {
      method: 'POST',
      body: JSON.stringify({
        inputType,
        inputValue: input || undefined,
        fileUrl,
        purchaseDate: localDate(),
        accessKey: mode === 'key' ? input : undefined,
        nfceUrl: mode === 'url' ? input : undefined,
      }),
    })
  }

  async function createPending() {
    setSaving(true)
    try {
      if (mode === 'file' && file) {
        const uploaded = await uploadFile(file)
        const result = await persistPending(file.type === 'application/pdf' ? 'pdf' : 'image', uploaded.url)
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
    const uploaded = await uploadFile(photo)
    const result = await persistPending('image', uploaded.url)
    if (result.imported && result.id) created(result.id)
    else { setMode('file'); setFile(null); handleResult(result) }
    return result.message
  }

  if (mode === 'camera') {
    return <CameraCapture
      initialFacingMode={cameraFacingMode}
      onBack={() => changeMode('scan')}
      chooseFile={() => changeMode('file')}
      submitPhoto={submitPhoto}
      openManual={() => navigate('manual')}
    />
  }

  if (mode === 'scan') {
    const options = [
      { mode: 'camera' as const, label: 'Câmera', icon: QrCode },
      { mode: 'key' as const, label: 'Chave', icon: Keyboard },
      { mode: 'url' as const, label: 'URL', icon: Link2 },
      { mode: 'file' as const, label: 'Arquivo', icon: Upload },
    ]
    return <div className="flex h-full flex-col bg-[#08080B] text-white">
      <div className="flex h-14 items-center justify-between border-b border-white/10 px-4"><button aria-label="Fechar" onClick={onBack} className="grid h-8 w-8 place-items-center rounded-full bg-white/10"><X size={17} /></button><strong className="text-[11px]">Escanear nota</strong><span className="w-8" /></div>
      <div className="scanner-grid relative flex flex-1 flex-col items-center justify-center overflow-hidden bg-[linear-gradient(180deg,#0A0A0E,#131426_72%,#08080B)]"><div className="scan-frame relative h-48 w-64"><i /><i /><i /><i /><span /></div><QrCode size={62} className="absolute text-white/10" /><p className="mt-14 flex items-center gap-1 text-[9px] font-bold"><Zap size={13} className="text-indigo-400" /> Aponte para o QR Code ou chave da nota</p><small className="mt-1 text-[7px] text-white/30">O código pode estar inclinado ou fora do centro</small><button aria-label="Abrir câmera" onClick={() => changeMode('camera')} className="mt-10 h-17 w-17 rounded-full border-3 border-white p-1.5"><span className="block h-full w-full rounded-full bg-slate-200" /></button><button onClick={() => changeMode('key')} className="mt-5 flex items-center gap-1 border-b border-white/20 py-1 text-[8px] text-white/55"><Keyboard size={13} /> Digitar chave manualmente</button></div>
      <div className="grid h-20 grid-cols-4 border-t border-white/10 bg-[#08080B] px-2 pb-4 pt-2">{options.map((item) => { const Icon = item.icon; return <button key={item.mode} onClick={() => changeMode(item.mode)} className="flex flex-col items-center gap-1 text-[7px] text-white/40"><Icon size={17} />{item.label}</button> })}</div>
    </div>
  }

  return <div className="px-4 pb-8">
    <PageHeader title={mode === 'key' ? 'Digitar chave' : mode === 'url' ? 'Colar URL da NFC-e' : 'Enviar arquivo'} subtitle="Consulta oficial e importação dos itens" onBack={() => changeMode('scan')} />
    <div className="mb-4 rounded-xl bg-emerald-50 p-3 text-[9px] leading-4 text-emerald-800"><strong>Importação real da NFC-e.</strong><p>O QR Code ou a chave é validado e consultado no portal oficial. Nada é inventado quando a consulta não responde.</p></div>
    {mode === 'key' && <label className="form-label">Chave de acesso<input value={input} onChange={(event) => { setInput(event.target.value.replace(/\D/g, '').slice(0, 44)); setMessage(''); setLastResult(null) }} className="form-input" inputMode="numeric" placeholder="44 dígitos" /><small className="text-right text-[8px] text-slate-400">{input.length}/44</small></label>}
    {mode === 'url' && <label className="form-label">URL da nota<input value={input} onChange={(event) => { setInput(event.target.value); setMessage(''); setLastResult(null) }} className="form-input" type="url" placeholder="https://…" /></label>}
    {mode === 'file' && <label className="grid min-h-44 cursor-pointer place-content-center justify-items-center gap-2 rounded-2xl border-2 border-dashed border-indigo-200 bg-indigo-50 text-center text-indigo-600"><ImageIcon size={28} /><strong className="text-xs">Escolher foto ou PDF</strong><span className="text-[9px] text-slate-400">{file?.name || 'JPG, PNG, WEBP ou PDF · até 10 MB'}</span><input type="file" accept="image/jpeg,image/png,image/webp,.pdf,application/pdf" className="hidden" onChange={(event) => { setFile(event.target.files?.[0] ?? null); setMessage(''); setLastResult(null) }} /></label>}
    {message && <div role="status" className={'mt-4 rounded-xl p-3 text-[9px] leading-4 ' + (lastResult?.duplicate ? 'bg-amber-50 text-amber-800' : 'bg-rose-50 text-rose-700')}><strong className="block">{lastResult?.duplicate ? 'Nota já importada' : 'Não foi possível importar automaticamente'}</strong><p className="mt-1">{message}</p><div className="mt-3 flex flex-wrap gap-2">{lastResult?.duplicate && lastResult.id && <button onClick={() => created(lastResult.id as string)} className="rounded-lg bg-amber-100 px-2.5 py-2 font-bold">Abrir compra existente</button>}{mode === 'file' && <button onClick={() => { setFile(null); setMessage(''); setLastResult(null) }} className="rounded-lg bg-white px-2.5 py-2 font-bold shadow-sm">Tentar outra foto</button>}<button onClick={() => changeMode('key', lastResult?.detectedAccessKey ?? '')} className="rounded-lg bg-white px-2.5 py-2 font-bold shadow-sm">Digitar chave</button><button onClick={() => navigate('manual')} className="rounded-lg bg-white px-2.5 py-2 font-bold shadow-sm">Cadastrar manualmente</button></div></div>}
    <PrimaryButton className="mt-5" onClick={createPending} disabled={saving || (mode === 'key' ? input.length !== 44 : mode === 'file' ? !file : !input)}>{saving ? 'Lendo e consultando a SEFAZ…' : 'Identificar e importar nota'}</PrimaryButton>
    <div className="my-5 flex items-center gap-3 text-[8px] text-slate-300"><span className="h-px flex-1 bg-slate-200" />ou registre agora<span className="h-px flex-1 bg-slate-200" /></div>
    <div className="grid grid-cols-2 gap-2"><button onClick={() => navigate('text')} className="rounded-xl border border-slate-200 bg-white p-3 text-left"><FileText size={18} className="text-indigo-500" /><strong className="mt-2 block text-[10px]">Colar texto</strong><small className="text-[8px] text-slate-400">Uma linha por item</small></button><button onClick={() => navigate('manual')} className="rounded-xl border border-slate-200 bg-white p-3 text-left"><Camera size={18} className="text-emerald-500" /><strong className="mt-2 block text-[10px]">Cadastro manual</strong><small className="text-[8px] text-slate-400">Compra e itens</small></button></div>
  </div>
}
