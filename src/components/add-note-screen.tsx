'use client'

import { useCallback, useRef, useState } from 'react'
import { Camera, ChevronDown, ChevronRight, FileText, ImagePlus, Keyboard, Link2, PackagePlus, ReceiptText, RotateCcw, ShieldCheck, Upload, X } from 'lucide-react'
import { brl, clientApi, dateLabel, localDate } from '@/lib/client-api'
import type { AppScreen } from '@/lib/client-types'
import { prepareBackendQrFallback, readQrCodeFromImage } from '@/lib/client-qr'
import { CameraCapture } from './camera-capture'
import { PageHeader, PrimaryButton } from './ui'

type Mode = 'camera' | 'options' | 'key' | 'url' | 'processing' | 'preview' | 'error' | 'duplicate'
type InputType = 'access_key' | 'nfce_url' | 'qr_code_url'
type ImportSource = { inputType: InputType; inputValue: string }

type ImportResponse = {
  id: string | null
  imported: boolean
  duplicate: boolean
  itemCount: number
  message: string
  errorCode?: string
  detectedAccessKey?: string
}

type PreviewResponse = {
  ready: boolean
  duplicate: boolean
  id?: string
  itemCount: number
  message: string
  errorCode?: string
  detectedAccessKey?: string
  receipt?: {
    accessKey: string
    nfceUrl: string
    storeName: string
    storeDocument?: string
    city?: string
    state?: string
    purchaseDate: string
    totalAmount: number
  }
  items?: {
    rawName: string
    quantity: number
    unitPrice: number
    unit: string
    totalPrice: number
  }[]
}

function aborted() {
  return new DOMException('Leitura cancelada.', 'AbortError')
}

export function AddNoteScreen({ navigate, onBack, cameraFacingMode, created }: {
  navigate: (screen: AppScreen) => void
  onBack: () => void
  cameraFacingMode: 'environment' | 'user'
  created: (id: string) => void
}) {
  const [mode, setMode] = useState<Mode>('camera')
  const [input, setInput] = useState('')
  const [source, setSource] = useState<ImportSource | null>(null)
  const [preview, setPreview] = useState<PreviewResponse | null>(null)
  const [message, setMessage] = useState('')
  const [saving, setSaving] = useState(false)
  const [showAllItems, setShowAllItems] = useState(false)
  const analysisControllerRef = useRef<AbortController | null>(null)

  function beginAnalysis() {
    analysisControllerRef.current?.abort()
    const controller = new AbortController()
    analysisControllerRef.current = controller
    return controller
  }

  const cancelAnalysis = useCallback(() => {
    analysisControllerRef.current?.abort()
    analysisControllerRef.current = null
  }, [])

  function clearAnalysis(nextMode: Mode) {
    cancelAnalysis()
    setSource(null)
    setPreview(null)
    setMessage('')
    setShowAllItems(false)
    setMode(nextMode)
  }

  function cancelImport() {
    cancelAnalysis()
    onBack()
  }

  async function decodeWithBackendFallback(selectedFile: File, controller: AbortController) {
    try {
      const decoded = await readQrCodeFromImage(selectedFile)
      if (controller.signal.aborted) throw aborted()
      return decoded
    } catch {
      if (controller.signal.aborted) throw aborted()
      const temporaryFile = await prepareBackendQrFallback(selectedFile)
      if (controller.signal.aborted) throw aborted()
      const form = new FormData()
      form.append('file', temporaryFile)
      return (await clientApi<{ decodedText: string }>('/api/uploads', {
        method: 'POST',
        body: form,
        signal: controller.signal,
      })).decodedText
    }
  }

  async function requestPreview(nextSource: ImportSource, controller: AbortController) {
    const result = await clientApi<PreviewResponse>('/api/import-jobs/preview', {
      method: 'POST',
      body: JSON.stringify({ ...nextSource, purchaseDate: localDate() }),
      signal: controller.signal,
    })
    if (controller.signal.aborted) throw aborted()
    setSource(nextSource)
    setMessage(result.message)
    setPreview(result)
    if (result.duplicate) setMode('duplicate')
    else if (result.ready) setMode('preview')
    else setMode('error')
  }

  async function analyzePhoto(selectedFile: File, keepCameraVisible: boolean) {
    const controller = beginAnalysis()
    if (!keepCameraVisible) setMode('processing')
    setMessage('Lendo o QR Code no aparelho…')
    try {
      const decodedText = await decodeWithBackendFallback(selectedFile, controller)
      const inputType: InputType = /^\d{44}$/.test(decodedText.trim()) ? 'access_key' : 'qr_code_url'
      setMessage('Consultando os dados oficiais da nota…')
      await requestPreview({ inputType, inputValue: decodedText }, controller)
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') throw error
      setMessage(error instanceof Error ? error.message : 'Não foi possível analisar esta foto.')
      setMode('error')
      throw error
    } finally {
      if (analysisControllerRef.current === controller) analysisControllerRef.current = null
    }
  }

  async function analyzeText(inputType: InputType) {
    const controller = beginAnalysis()
    setMode('processing')
    setMessage('Consultando os dados oficiais da nota…')
    try {
      await requestPreview({ inputType, inputValue: input }, controller)
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return
      setMessage(error instanceof Error ? error.message : 'Não foi possível analisar esta nota.')
      setMode('error')
    } finally {
      if (analysisControllerRef.current === controller) analysisControllerRef.current = null
    }
  }

  async function confirmImport() {
    if (!source) return
    setSaving(true)
    try {
      const result = await clientApi<ImportResponse>('/api/import-jobs', {
        method: 'POST',
        body: JSON.stringify({ ...source, purchaseDate: localDate() }),
      })
      if (result.imported && result.id) created(result.id)
      else if (result.duplicate) {
        setPreview({ ready: false, duplicate: true, id: result.id ?? undefined, itemCount: result.itemCount, message: result.message })
        setMode('duplicate')
      } else {
        setMessage(result.message)
        setMode('error')
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Não foi possível salvar esta nota.')
      setMode('error')
    } finally {
      setSaving(false)
    }
  }

  function selectGalleryFile(event: React.ChangeEvent<HTMLInputElement>, keepCameraVisible: boolean) {
    const selected = event.currentTarget.files?.[0]
    event.currentTarget.value = ''
    if (selected) void analyzePhoto(selected, keepCameraVisible).catch(() => undefined)
  }

  if (mode === 'camera') {
    return <CameraCapture
      initialFacingMode={cameraFacingMode}
      onBack={cancelImport}
      analyzePhoto={(file) => analyzePhoto(file, true)}
      cancelAnalysis={cancelAnalysis}
      openManual={() => navigate('manual')}
      openKey={() => clearAnalysis('key')}
      openOptions={() => clearAnalysis('options')}
    />
  }

  if (mode === 'processing') {
    return <div className="min-h-full bg-slate-50 px-4 pb-8">
      <PageHeader title="Lendo sua nota" subtitle="Ainda não salvamos nada" onBack={() => clearAnalysis('options')} />
      <section className="mt-12 grid justify-items-center gap-5 text-center">
        <span className="grid h-20 w-20 place-items-center rounded-3xl bg-indigo-100 text-indigo-600"><ReceiptText className="animate-pulse" size={36} /></span>
        <div><h2 className="text-xl font-black text-slate-950">Só um instante</h2><p className="mt-2 max-w-xs text-sm leading-6 text-slate-600">{message}</p></div>
        <button onClick={() => clearAnalysis('options')} className="min-h-11 rounded-xl px-5 text-sm font-bold text-slate-500">Cancelar leitura</button>
      </section>
    </div>
  }

  if (mode === 'preview' && preview?.receipt && preview.items) {
    const visibleItems = showAllItems ? preview.items : preview.items.slice(0, 5)
    return <div className="min-h-full bg-slate-50 pb-5">
      <div className="flex items-center justify-between px-4 py-3">
        <button aria-label="Cancelar importação" onClick={cancelImport} className="grid h-11 w-11 place-items-center rounded-full bg-white text-slate-600 shadow-sm"><X size={20} /></button>
        <span className="rounded-full bg-emerald-100 px-3 py-1.5 text-xs font-bold text-emerald-700">Nada salvo ainda</span>
      </div>
      <div className="px-4">
        <h1 className="text-2xl font-black tracking-tight text-slate-950">Confira antes de importar</h1>
        <p className="mt-1 text-sm text-slate-600">Veja se esta é a nota certa. Você ainda pode cancelar.</p>

        <section className="mt-5 overflow-hidden rounded-3xl bg-slate-950 p-5 text-white shadow-lg">
          <div className="flex items-start gap-3"><span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-white/10"><ReceiptText size={22} /></span><div className="min-w-0 flex-1"><span className="text-xs text-white/55">Estabelecimento</span><strong className="mt-1 block truncate text-lg">{preview.receipt.storeName}</strong><small className="mt-1 block text-white/60">{dateLabel(preview.receipt.purchaseDate)} · {preview.itemCount} itens</small></div></div>
          <div className="mt-5 flex items-end justify-between border-t border-white/10 pt-4"><span className="text-sm text-white/60">Total da nota</span><strong className="text-3xl tracking-tight">{brl(preview.receipt.totalAmount)}</strong></div>
        </section>

        <section className="mt-4 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-2 flex items-center justify-between"><h2 className="font-black text-slate-950">Itens encontrados</h2><span className="text-xs font-bold text-slate-400">{preview.itemCount}</span></div>
          <div className="divide-y divide-slate-100">{visibleItems.map((item, index) => <div key={`${item.rawName}-${index}`} className="flex gap-3 py-3"><span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-indigo-50 text-xs font-black text-indigo-600">{index + 1}</span><div className="min-w-0 flex-1"><strong className="block truncate text-sm text-slate-800">{item.rawName}</strong><small className="mt-1 block text-xs text-slate-500">{item.quantity} {item.unit} × {brl(item.unitPrice)}</small></div><b className="shrink-0 text-sm text-slate-800">{brl(item.totalPrice)}</b></div>)}</div>
          {preview.items.length > 5 && <button onClick={() => setShowAllItems((current) => !current)} className="mt-2 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-slate-50 text-sm font-bold text-slate-600">{showAllItems ? 'Mostrar menos' : `Ver todos os ${preview.items.length} itens`}<ChevronDown size={16} className={showAllItems ? 'rotate-180' : ''} /></button>}
        </section>

        <div className="mt-4 flex items-center gap-2 rounded-2xl bg-emerald-50 p-3 text-sm text-emerald-800"><ShieldCheck className="shrink-0" size={20} /><span>A foto não será salva. Apenas os dados acima entrarão no seu histórico.</span></div>
        <PrimaryButton className="mt-5" onClick={() => void confirmImport()} disabled={saving}>{saving ? 'Salvando compra…' : 'Confirmar importação'}</PrimaryButton>
        <div className="mt-2 grid grid-cols-2 gap-2"><button onClick={() => clearAnalysis('camera')} disabled={saving} className="min-h-12 rounded-2xl bg-white text-sm font-bold text-indigo-600 shadow-sm disabled:opacity-40"><RotateCcw className="mr-2 inline" size={16} />Outra foto</button><button onClick={cancelImport} disabled={saving} className="min-h-12 rounded-2xl text-sm font-bold text-rose-600 disabled:opacity-40">Cancelar</button></div>
      </div>
    </div>
  }

  if (mode === 'duplicate') {
    return <div className="min-h-full bg-slate-50 px-4 pb-8">
      <PageHeader title="Nota já importada" subtitle="Nenhum dado foi duplicado" onBack={() => clearAnalysis('options')} />
      <section className="mt-8 grid justify-items-center rounded-3xl border border-amber-200 bg-amber-50 p-6 text-center"><span className="grid h-16 w-16 place-items-center rounded-3xl bg-amber-100 text-amber-700"><ReceiptText size={30} /></span><h2 className="mt-4 text-xl font-black text-amber-950">Esta nota já está no histórico</h2><p className="mt-2 text-sm leading-6 text-amber-800">{preview?.message}</p></section>
      {preview?.id && <PrimaryButton className="mt-5" onClick={() => created(preview.id as string)}>Abrir nota existente</PrimaryButton>}
      <button onClick={() => clearAnalysis('camera')} className="mt-2 min-h-12 w-full rounded-2xl bg-white text-sm font-bold text-indigo-600 shadow-sm">Ler outra nota</button>
      <button onClick={cancelImport} className="mt-2 min-h-11 w-full text-sm font-bold text-slate-500">Cancelar</button>
    </div>
  }

  if (mode === 'error') {
    return <div className="min-h-full bg-slate-50 px-4 pb-8">
      <PageHeader title="Não consegui ler a nota" subtitle="Sua compra não foi salva" onBack={() => clearAnalysis('options')} />
      <section className="mt-6 rounded-3xl border border-rose-100 bg-white p-5 shadow-sm"><span className="grid h-12 w-12 place-items-center rounded-2xl bg-rose-50 text-rose-600"><X size={24} /></span><h2 className="mt-4 text-lg font-black text-slate-950">Vamos tentar de outro jeito</h2><p className="mt-2 text-sm leading-6 text-slate-600">{message}</p></section>
      <PrimaryButton className="mt-5" onClick={() => clearAnalysis('camera')}><Camera size={19} />Tirar outra foto</PrimaryButton>
      <div className="mt-2 grid grid-cols-2 gap-2"><button onClick={() => clearAnalysis('key')} className="min-h-12 rounded-2xl bg-white text-sm font-bold text-slate-700 shadow-sm"><Keyboard className="mr-2 inline" size={17} />Digitar chave</button><button onClick={() => navigate('manual')} className="min-h-12 rounded-2xl bg-white text-sm font-bold text-slate-700 shadow-sm"><PackagePlus className="mr-2 inline" size={17} />Manual</button></div>
      <button onClick={cancelImport} className="mt-3 min-h-11 w-full text-sm font-bold text-slate-500">Cancelar importação</button>
    </div>
  }

  if (mode === 'options') {
    return <div className="min-h-full bg-slate-50 px-4 pb-8">
      <PageHeader title="Adicionar nota" subtitle="Escolha o jeito mais rápido" onBack={cancelImport} />
      <button onClick={() => clearAnalysis('camera')} className="mt-3 flex min-h-24 w-full items-center gap-4 rounded-3xl bg-indigo-600 p-5 text-left text-white shadow-lg"><span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-white/15"><Camera size={27} /></span><span className="min-w-0 flex-1"><strong className="block text-lg">Abrir câmera</strong><small className="mt-1 block text-sm text-white/70">Fotografe o QR Code e revise antes de salvar.</small></span><ChevronRight size={22} /></button>
      <label className="mt-3 flex min-h-20 cursor-pointer items-center gap-4 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm"><span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-cyan-50 text-cyan-700"><ImagePlus size={23} /></span><span className="min-w-0 flex-1"><strong className="block text-base text-slate-950">Escolher da galeria</strong><small className="mt-1 block text-sm text-slate-500">Selecionou, começou: sem botão extra.</small></span><Upload className="text-slate-400" size={20} /><input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(event) => selectGalleryFile(event, false)} /></label>
      <h2 className="mb-3 mt-7 text-sm font-black uppercase tracking-wider text-slate-400">Outras opções</h2>
      <div className="grid gap-3">
        <button onClick={() => clearAnalysis('key')} className="flex min-h-18 items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 text-left"><span className="grid h-10 w-10 place-items-center rounded-xl bg-indigo-50 text-indigo-700"><Keyboard size={20} /></span><span className="flex-1"><strong className="block text-sm text-slate-900">Digitar chave</strong><small className="text-xs text-slate-500">44 dígitos da NFC-e</small></span><ChevronRight size={18} className="text-slate-400" /></button>
        <button onClick={() => clearAnalysis('url')} className="flex min-h-18 items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 text-left"><span className="grid h-10 w-10 place-items-center rounded-xl bg-violet-50 text-violet-700"><Link2 size={20} /></span><span className="flex-1"><strong className="block text-sm text-slate-900">Colar URL da nota</strong><small className="text-xs text-slate-500">Endereço do portal da SEFAZ</small></span><ChevronRight size={18} className="text-slate-400" /></button>
        <button onClick={() => navigate('manual')} className="flex min-h-18 items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 text-left"><span className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-50 text-emerald-700"><PackagePlus size={20} /></span><span className="flex-1"><strong className="block text-sm text-slate-900">Cadastrar manualmente</strong><small className="text-xs text-slate-500">Informe os produtos e preços</small></span><ChevronRight size={18} className="text-slate-400" /></button>
        <button onClick={() => navigate('text')} className="flex min-h-18 items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 text-left"><span className="grid h-10 w-10 place-items-center rounded-xl bg-amber-50 text-amber-700"><FileText size={20} /></span><span className="flex-1"><strong className="block text-sm text-slate-900">Colar lista de produtos</strong><small className="text-xs text-slate-500">Uma linha para cada item</small></span><ChevronRight size={18} className="text-slate-400" /></button>
      </div>
    </div>
  }

  const isKey = mode === 'key'
  return <div className="min-h-full bg-slate-50 px-4 pb-8">
    <PageHeader title={isKey ? 'Digitar chave' : 'Colar URL da nota'} subtitle="Você revisará tudo antes de salvar" onBack={() => clearAnalysis('options')} />
    <form onSubmit={(event) => { event.preventDefault(); void analyzeText(isKey ? 'access_key' : 'nfce_url') }}>
      <section className="mt-3 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
        {isKey ? <label className="form-label">Chave de acesso<input autoFocus value={input} onChange={(event) => setInput(event.target.value.replace(/\D/g, '').slice(0, 44))} className="form-input" inputMode="numeric" placeholder="44 dígitos" /><small className="mt-1 block text-right text-xs text-slate-400">{input.length}/44</small></label> : <label className="form-label">URL da NFC-e<input autoFocus value={input} onChange={(event) => setInput(event.target.value)} className="form-input" type="url" placeholder="https://…" /></label>}
      </section>
      <PrimaryButton className="mt-5" disabled={isKey ? input.length !== 44 : !input.trim()}>Revisar nota</PrimaryButton>
    </form>
    <button onClick={cancelImport} className="mt-3 min-h-11 w-full text-sm font-bold text-slate-500">Cancelar importação</button>
  </div>
}
