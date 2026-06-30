'use client'

import jsQR from 'jsqr'

const MAX_DECODE_DIMENSION = 1600
const FALLBACK_MAX_BYTES = 2_400_000

type BarcodeDetectorResult = { rawValue?: string }
type BarcodeDetectorInstance = { detect(source: CanvasImageSource): Promise<BarcodeDetectorResult[]> }
type BarcodeDetectorConstructor = new (options: { formats: string[] }) => BarcodeDetectorInstance

function barcodeDetector() {
  const Detector = (window as typeof window & { BarcodeDetector?: BarcodeDetectorConstructor }).BarcodeDetector
  try {
    return Detector ? new Detector({ formats: ['qr_code'] }) : null
  } catch {
    return null
  }
}

function decodedQr(data: ImageData) {
  return jsQR(data.data, data.width, data.height, { inversionAttempts: 'attemptBoth' })?.data.trim() || null
}

export function decodeQrFromCanvas(canvas: HTMLCanvasElement) {
  const context = canvas.getContext('2d', { willReadFrequently: true })
  if (!context) return null

  const full = decodedQr(context.getImageData(0, 0, canvas.width, canvas.height))
  if (full) return full

  const minimum = Math.min(canvas.width, canvas.height)
  const candidates = [
    { x: 0.5, y: 0.5, scale: 0.7 },
    { x: 0.5, y: 0.5, scale: 0.4 },
    ...[0.25, 0.5, 0.75].flatMap((x) => [0.25, 0.5, 0.75].map((y) => ({ x, y, scale: 0.5 }))),
  ]
  for (const candidate of candidates) {
    const size = Math.max(1, Math.round(minimum * candidate.scale))
    const left = Math.max(0, Math.min(canvas.width - size, Math.round(canvas.width * candidate.x - size / 2)))
    const top = Math.max(0, Math.min(canvas.height - size, Math.round(canvas.height * candidate.y - size / 2)))
    const result = decodedQr(context.getImageData(left, top, size, size))
    if (result) return result
  }
  return null
}

async function imageSource(file: File) {
  if ('createImageBitmap' in window) {
    const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
    return {
      source: bitmap as CanvasImageSource,
      width: bitmap.width,
      height: bitmap.height,
      dispose: () => bitmap.close(),
    }
  }

  const url = URL.createObjectURL(file)
  const image = new Image()
  image.decoding = 'async'
  image.src = url
  try {
    await image.decode()
  } catch (error) {
    URL.revokeObjectURL(url)
    throw error
  }
  return {
    source: image as CanvasImageSource,
    width: image.naturalWidth,
    height: image.naturalHeight,
    dispose: () => URL.revokeObjectURL(url),
  }
}

async function imageCanvas(file: File, maximumDimension = MAX_DECODE_DIMENSION) {
  const image = await imageSource(file)
  try {
    const scale = Math.min(1, maximumDimension / Math.max(image.width, image.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(image.width * scale))
    canvas.height = Math.max(1, Math.round(image.height * scale))
    const context = canvas.getContext('2d', { willReadFrequently: true })
    if (!context) throw new Error('O navegador não conseguiu preparar a imagem para leitura.')
    context.drawImage(image.source, 0, 0, canvas.width, canvas.height)
    return canvas
  } finally {
    image.dispose()
  }
}

export async function readQrCodeFromImage(file: File) {
  if (!file.type.startsWith('image/')) throw new Error('Escolha uma imagem com o QR Code da NFC-e.')
  const canvas = await imageCanvas(file)
  const detector = barcodeDetector()
  if (detector) {
    try {
      const detected = await detector.detect(canvas)
      const value = detected.find((result) => result.rawValue?.trim())?.rawValue?.trim()
      if (value) return value
    } catch {
      // O jsQR abaixo cobre navegadores com BarcodeDetector parcial.
    }
  }
  const decoded = decodeQrFromCanvas(canvas)
  if (!decoded) throw new Error('Não foi possível encontrar o QR Code nesta foto.')
  return decoded
}

function canvasBlob(canvas: HTMLCanvasElement, quality: number) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('Não foi possível preparar a foto temporária.')), 'image/jpeg', quality)
  })
}

export async function prepareBackendQrFallback(file: File) {
  for (const maximumDimension of [1600, 1280, 1024]) {
    const canvas = await imageCanvas(file, maximumDimension)
    for (const quality of [0.86, 0.74]) {
      const blob = await canvasBlob(canvas, quality)
      if (blob.size <= FALLBACK_MAX_BYTES) {
        return new File([blob], 'qr-fallback.jpg', { type: 'image/jpeg' })
      }
    }
  }
  throw new Error('A foto é grande demais para a leitura auxiliar. Recorte a imagem ao redor do QR Code.')
}
