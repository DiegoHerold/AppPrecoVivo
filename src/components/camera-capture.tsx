'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Camera, ImagePlus, Keyboard, LayoutGrid, PackagePlus, RefreshCw, SwitchCamera, X } from 'lucide-react'
import { requestCamera } from '@/lib/camera'

type CameraState = 'requesting' | 'active' | 'processing' | 'captured' | 'error'

function cameraErrorMessage(error: unknown) {
  if (!window.isSecureContext) return 'A câmera exige HTTPS ou acesso por localhost.'
  if (error instanceof DOMException && error.name === 'NotAllowedError') return 'Permissão da câmera negada. Libere o acesso nas configurações do navegador.'
  if (error instanceof DOMException && error.name === 'NotFoundError') return 'Nenhuma câmera foi encontrada neste dispositivo.'
  if (error instanceof DOMException && error.name === 'NotReadableError') return 'A câmera está sendo usada por outro aplicativo.'
  if (error instanceof DOMException && error.name === 'TimeoutError') return 'A permissão não foi respondida. Tente novamente ou escolha uma foto.'
  return 'Não foi possível iniciar a câmera. Você ainda pode escolher uma foto.'
}

export function CameraCapture({ initialFacingMode, onBack, analyzePhoto, cancelAnalysis, openManual, openKey, openOptions }: {
  initialFacingMode: 'environment' | 'user'
  onBack: () => void
  analyzePhoto: (file: File) => Promise<void>
  cancelAnalysis: () => void
  openManual: () => void
  openKey: () => void
  openOptions: () => void
}) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const requestGenerationRef = useRef(0)
  const photoRef = useRef<File | null>(null)
  const [facingMode, setFacingMode] = useState(initialFacingMode)
  const [state, setState] = useState<CameraState>('requesting')
  const [message, setMessage] = useState('Abrindo a câmera do aparelho…')

  const stopCamera = useCallback(() => {
    requestGenerationRef.current += 1
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
  }, [])

  const startCamera = useCallback(async (nextFacingMode: 'environment' | 'user') => {
    stopCamera()
    photoRef.current = null
    const requestGeneration = requestGenerationRef.current
    setState('requesting')
    setMessage('Solicitando acesso à câmera…')
    try {
      const stream = await requestCamera({
        audio: false,
        video: { facingMode: { ideal: nextFacingMode }, width: { ideal: 1920 }, height: { ideal: 1080 } },
      })
      if (requestGeneration !== requestGenerationRef.current) {
        stream.getTracks().forEach((track) => track.stop())
        return
      }
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
      }
      setState('active')
      setMessage('Aproxime e enquadre somente o QR Code.')
    } catch (error) {
      setState('error')
      setMessage(error instanceof Error && error.message === 'CAMERA_UNAVAILABLE' ? 'Este navegador não oferece acesso à câmera. Escolha uma foto do aparelho.' : cameraErrorMessage(error))
    }
  }, [stopCamera])

  useEffect(() => {
    const timer = window.setTimeout(() => void startCamera(initialFacingMode), 0)
    return () => {
      window.clearTimeout(timer)
      cancelAnalysis()
      stopCamera()
    }
  }, [cancelAnalysis, initialFacingMode, startCamera, stopCamera])

  async function processPhoto(file: File) {
    photoRef.current = file
    stopCamera()
    setState('processing')
    setMessage('Lendo o QR Code e buscando a nota…')
    try {
      await analyzePhoto(file)
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        await startCamera(facingMode)
        return
      }
      setState('captured')
      setMessage(error instanceof Error ? error.message : 'Não foi possível ler esta foto.')
    }
  }

  function capture() {
    const video = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas || !video.videoWidth || !video.videoHeight) return
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const context = canvas.getContext('2d')
    if (!context) return
    if (facingMode === 'user') {
      context.translate(canvas.width, 0)
      context.scale(-1, 1)
    }
    context.drawImage(video, 0, 0, canvas.width, canvas.height)
    canvas.toBlob((blob) => {
      if (!blob) return
      void processPhoto(new File([blob], `nota-${Date.now()}.jpg`, { type: 'image/jpeg' }))
    }, 'image/jpeg', 0.88)
  }

  function selectGalleryFile(event: React.ChangeEvent<HTMLInputElement>) {
    const selected = event.currentTarget.files?.[0]
    event.currentTarget.value = ''
    if (selected) void processPhoto(selected)
  }

  function cancelReading() {
    cancelAnalysis()
  }

  async function switchCamera() {
    const next = facingMode === 'environment' ? 'user' : 'environment'
    setFacingMode(next)
    await startCamera(next)
  }

  function close() {
    cancelAnalysis()
    stopCamera()
    onBack()
  }

  const galleryButton = <label className="flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl bg-white/10 px-3 text-sm font-semibold text-white/85"><ImagePlus size={17} /> Galeria<input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={selectGalleryFile} /></label>

  return <div className="flex h-full flex-col bg-[#08080B] text-white">
    <header className="flex h-16 items-center justify-between border-b border-white/10 px-4"><button aria-label="Cancelar importação" onClick={close} className="grid h-11 w-11 place-items-center rounded-full bg-white/10"><X size={19} /></button><div className="text-center"><strong className="block text-sm">Ler QR Code</strong><small className="text-xs text-white/45">1 foto · depois você revisa</small></div><button aria-label="Trocar câmera" onClick={() => void switchCamera()} disabled={state !== 'active'} className="grid h-11 w-11 place-items-center rounded-full bg-white/10 disabled:opacity-30"><SwitchCamera size={19} /></button></header>
    <div className="relative flex flex-1 items-center justify-center overflow-hidden bg-black">
      <video ref={videoRef} muted playsInline className={`h-full w-full object-cover ${facingMode === 'user' ? '-scale-x-100' : ''} ${state === 'active' ? 'block' : 'hidden'}`} />
      <canvas ref={canvasRef} className={`max-h-full max-w-full object-contain ${state === 'captured' || state === 'processing' ? 'block' : 'hidden'}`} />
      {state === 'requesting' && <div className="grid justify-items-center gap-3 text-center"><span className="h-10 w-10 animate-spin rounded-full border-3 border-white/20 border-t-indigo-400" /><p className="text-sm text-white/60">{message}</p></div>}
      {state === 'processing' && <div className="absolute inset-0 grid place-content-center justify-items-center gap-4 bg-black/75 px-8 text-center backdrop-blur-sm"><span className="h-12 w-12 animate-spin rounded-full border-4 border-white/20 border-t-indigo-400" /><div><strong className="text-lg">Analisando a nota</strong><p className="mt-2 text-sm leading-6 text-white/60">{message}</p></div><button onClick={cancelReading} className="min-h-11 rounded-xl bg-white/10 px-5 text-sm font-bold">Cancelar leitura</button></div>}
      {state === 'error' && <div className="mx-6 grid max-w-sm justify-items-center gap-3 rounded-3xl bg-white/10 p-6 text-center"><Camera className="text-amber-300" size={30} /><strong className="text-lg">Câmera indisponível</strong><p className="text-sm leading-6 text-white/65">{message}</p><button onClick={() => void startCamera(facingMode)} className="flex min-h-11 items-center gap-2 rounded-xl bg-indigo-600 px-4 text-sm font-bold"><RefreshCw size={17} /> Tentar novamente</button><div className="grid w-full grid-cols-2 gap-2">{galleryButton}<button onClick={openManual} className="flex min-h-11 items-center justify-center gap-2 rounded-xl bg-white/10 px-3 text-sm text-white/80"><PackagePlus size={17} /> Manual</button></div><button onClick={openOptions} className="min-h-11 text-sm font-bold text-indigo-300">Ver outras opções</button></div>}
      {state === 'captured' && <div className="absolute inset-x-5 bottom-5 rounded-3xl bg-slate-950/95 p-5 text-center shadow-2xl"><strong className="text-base">Não encontrei o QR Code</strong><p className="mt-2 text-sm leading-5 text-white/60">{message}</p><div className="mt-4 grid grid-cols-2 gap-2"><button onClick={() => void startCamera(facingMode)} className="min-h-11 rounded-xl bg-indigo-600 px-3 text-sm font-bold">Tirar outra</button>{galleryButton}</div></div>}
      {state === 'active' && <><div className="pointer-events-none absolute inset-x-12 top-1/2 aspect-square max-h-[68%] -translate-y-1/2 rounded-3xl border border-white/35"><i className="absolute -left-px -top-px h-10 w-10 rounded-tl-3xl border-l-4 border-t-4 border-indigo-400" /><i className="absolute -right-px -top-px h-10 w-10 rounded-tr-3xl border-r-4 border-t-4 border-indigo-400" /><i className="absolute -bottom-px -left-px h-10 w-10 rounded-bl-3xl border-b-4 border-l-4 border-indigo-400" /><i className="absolute -bottom-px -right-px h-10 w-10 rounded-br-3xl border-b-4 border-r-4 border-indigo-400" /></div><span className="pointer-events-none absolute top-5 rounded-full bg-black/55 px-4 py-2 text-xs font-semibold text-white/80">Preencha a moldura com o QR Code</span></>}
    </div>
    <footer className="border-t border-white/10 bg-[#08080B] px-5 pb-[max(16px,env(safe-area-inset-bottom))] pt-4 text-center">
      {state === 'active' && <><p className="mb-3 text-sm text-white/55">Toque uma vez. A leitura começa automaticamente.</p><button aria-label="Capturar e analisar QR Code" onClick={capture} className="mx-auto h-18 w-18 rounded-full border-4 border-white p-1.5"><span className="block h-full w-full rounded-full bg-white" /></button><div className="mt-4 grid grid-cols-3 gap-2">{galleryButton}<button onClick={openKey} className="flex min-h-11 items-center justify-center gap-2 rounded-xl bg-white/10 px-2 text-sm font-semibold text-white/80"><Keyboard size={16} /> Chave</button><button onClick={openOptions} className="flex min-h-11 items-center justify-center gap-2 rounded-xl bg-white/10 px-2 text-sm font-semibold text-white/80"><LayoutGrid size={16} /> Opções</button></div></>}
      {state === 'processing' && <p className="min-h-11 text-sm text-white/50">A foto não será salva.</p>}
    </footer>
  </div>
}
