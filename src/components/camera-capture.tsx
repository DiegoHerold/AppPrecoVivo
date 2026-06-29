'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Camera, CheckCircle2, ImagePlus, Keyboard, LayoutGrid, PackagePlus, RefreshCw, SwitchCamera, X } from 'lucide-react'
import { requestCamera } from '@/lib/camera'
import { PrimaryButton } from './ui'

type CameraState = 'idle' | 'requesting' | 'active' | 'captured' | 'uploading' | 'success' | 'error'

function cameraErrorMessage(error: unknown) {
  if (!window.isSecureContext) return 'A câmera exige HTTPS ou acesso por localhost.'
  if (error instanceof DOMException && error.name === 'NotAllowedError') return 'Permissão da câmera negada. Libere o acesso nas configurações do navegador.'
  if (error instanceof DOMException && error.name === 'NotFoundError') return 'Nenhuma câmera foi encontrada neste dispositivo.'
  if (error instanceof DOMException && error.name === 'NotReadableError') return 'A câmera está sendo usada por outro aplicativo.'
  if (error instanceof DOMException && error.name === 'TimeoutError') return 'A permissão não foi respondida. Tente novamente ou escolha uma foto.'
  return 'Não foi possível iniciar a câmera. Você ainda pode escolher uma foto.'
}

export function CameraCapture({ initialFacingMode, onBack, chooseFile, submitPhoto, openManual, openKey, openOptions }: {
  initialFacingMode: 'environment' | 'user'
  onBack: () => void
  chooseFile: () => void
  submitPhoto: (file: File) => Promise<string>
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
      setMessage('Centralize o QR Code ou a nota dentro da moldura.')
    } catch (error) {
      setState('error')
      setMessage(error instanceof Error && error.message === 'CAMERA_UNAVAILABLE' ? 'Este navegador não oferece acesso à câmera. Escolha uma foto do aparelho.' : cameraErrorMessage(error))
    }
  }, [stopCamera])

  useEffect(() => {
    const timer = window.setTimeout(() => void startCamera(initialFacingMode), 0)
    return () => {
      window.clearTimeout(timer)
      stopCamera()
    }
  }, [initialFacingMode, startCamera, stopCamera])

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
      photoRef.current = new File([blob], `nota-${Date.now()}.jpg`, { type: 'image/jpeg' })
      stopCamera()
      setState('captured')
      setMessage('Confira a foto antes de enviar.')
    }, 'image/jpeg', 0.88)
  }

  async function sendPhoto() {
    if (!photoRef.current) return
    setState('uploading')
    setMessage('Salvando a foto com segurança…')
    try {
      setMessage(await submitPhoto(photoRef.current))
      setState('success')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Não foi possível enviar a foto.')
      setState('captured')
    }
  }

  async function switchCamera() {
    const next = facingMode === 'environment' ? 'user' : 'environment'
    setFacingMode(next)
    await startCamera(next)
  }

  return <div className="flex h-full flex-col bg-[#08080B] text-white">
    <header className="flex h-14 items-center justify-between border-b border-white/10 px-4"><button aria-label="Fechar câmera" onClick={onBack} className="grid h-11 w-11 place-items-center rounded-full bg-white/10"><X size={18} /></button><strong className="text-[11px]">Fotografar nota</strong><button aria-label="Trocar câmera" onClick={() => void switchCamera()} disabled={state !== 'active'} className="grid h-11 w-11 place-items-center rounded-full bg-white/10 disabled:opacity-30"><SwitchCamera size={18} /></button></header>
    <div className="relative flex flex-1 items-center justify-center overflow-hidden bg-black">
      <video ref={videoRef} muted playsInline className={`h-full w-full object-cover ${facingMode === 'user' ? '-scale-x-100' : ''} ${state === 'active' ? 'block' : 'hidden'}`} />
      <canvas ref={canvasRef} className={`max-h-full max-w-full object-contain ${state === 'captured' || state === 'uploading' ? 'block' : 'hidden'}`} />
      {state === 'idle' && <div className="mx-6 grid max-w-xs justify-items-center gap-3 rounded-2xl bg-white/10 p-5 text-center"><Camera className="text-indigo-300" /><strong className="text-sm">Usar câmera do aparelho</strong><p className="text-[10px] leading-5 text-white/60">O navegador pedirá sua permissão antes de mostrar a imagem.</p><button onClick={() => void startCamera(facingMode)} className="rounded-xl bg-indigo-600 px-4 py-3 text-xs font-bold">Ativar câmera</button></div>}
      {(state === 'requesting' || state === 'uploading') && <div className="grid justify-items-center gap-3 text-center"><span className="h-9 w-9 animate-spin rounded-full border-3 border-white/20 border-t-indigo-400" /><p className="text-[10px] text-white/60">{message}</p></div>}
      {state === 'error' && <div className="mx-6 grid max-w-sm justify-items-center gap-3 rounded-2xl bg-white/10 p-5 text-center"><Camera className="text-amber-300" /><strong className="text-lg">Câmera indisponível</strong><p className="text-sm leading-6 text-white/65">{message}</p><button onClick={() => void startCamera(facingMode)} className="flex min-h-11 items-center gap-2 rounded-xl bg-indigo-600 px-4 text-sm font-bold text-white"><RefreshCw size={17} /> Tentar novamente</button><div className="grid w-full grid-cols-2 gap-2"><button onClick={chooseFile} className="flex min-h-11 items-center justify-center gap-2 rounded-xl bg-white/10 px-3 text-sm text-white/80"><ImagePlus size={17} /> Foto</button><button onClick={openManual} className="flex min-h-11 items-center justify-center gap-2 rounded-xl bg-white/10 px-3 text-sm text-white/80"><PackagePlus size={17} /> Manual</button></div><button onClick={openOptions} className="min-h-11 text-sm font-bold text-indigo-300">Ver todas as opções</button></div>}
      {state === 'success' && <div role="status" className="mx-6 grid max-w-xs justify-items-center gap-3 rounded-2xl bg-emerald-500/15 p-5 text-center"><CheckCircle2 className="text-emerald-300" /><strong className="text-sm">Foto salva</strong><p className="text-[10px] leading-5 text-white/65">{message}</p><button onClick={openManual} className="text-xs font-bold text-emerald-300">Cadastrar itens manualmente →</button></div>}
      {state === 'active' && <div className="pointer-events-none absolute inset-12 border border-white/25"><i className="absolute -left-px -top-px h-8 w-8 border-l-2 border-t-2 border-white" /><i className="absolute -right-px -top-px h-8 w-8 border-r-2 border-t-2 border-white" /><i className="absolute -bottom-px -left-px h-8 w-8 border-b-2 border-l-2 border-white" /><i className="absolute -bottom-px -right-px h-8 w-8 border-b-2 border-r-2 border-white" /></div>}
    </div>
    <footer className="min-h-36 border-t border-white/10 bg-[#08080B] px-5 pb-[max(16px,env(safe-area-inset-bottom))] pt-4 text-center">{state !== 'error' && <p className="mb-3 text-sm leading-5 text-white/60">{message}</p>}{state === 'active' && <button aria-label="Capturar foto" onClick={capture} className="mx-auto h-17 w-17 rounded-full border-3 border-white p-1.5"><span className="block h-full w-full rounded-full bg-white" /></button>}{state === 'captured' && <div className="grid grid-cols-2 gap-2"><button onClick={() => void startCamera(facingMode)} className="rounded-xl bg-white/10 px-3 text-sm font-bold">Tirar outra</button><PrimaryButton onClick={() => void sendPhoto()}>Usar foto</PrimaryButton></div>}{state !== 'captured' && state !== 'uploading' && state !== 'success' && <div className={`${state === 'error' ? '' : 'mt-3'} grid grid-cols-2 gap-2`}><button onClick={openKey} className="flex min-h-11 items-center justify-center gap-2 rounded-xl bg-white/10 px-3 text-sm font-semibold text-white/80"><Keyboard size={17} /> Digitar chave</button><button onClick={openOptions} className="flex min-h-11 items-center justify-center gap-2 rounded-xl bg-white/10 px-3 text-sm font-semibold text-white/80"><LayoutGrid size={17} /> Outras opções</button></div>}</footer>
  </div>
}
