import { randomUUID } from 'node:crypto'
import { unlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { requireUser } from '@/lib/auth'
import { errorResponse } from '@/lib/http'
import { accessKeyFrom, decodeQrFromImage, ImportFailure } from '@/lib/importers'

const allowedTypes: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
}
const MAX_FILE_SIZE = 2_800_000
const MAX_REQUEST_SIZE = 3_000_000

export const runtime = 'nodejs'

export async function POST(request: Request) {
  let absolutePath = ''
  try {
    await requireUser()
    const contentLength = Number(request.headers.get('content-length') ?? 0)
    if (contentLength > MAX_REQUEST_SIZE) {
      return Response.json({ error: 'A imagem temporária deve ter no máximo 2,8 MB.' }, { status: 413 })
    }
    const form = await request.formData()
    const file = form.get('file')
    if (!(file instanceof File)) return Response.json({ error: 'Selecione uma foto do QR Code.' }, { status: 400 })
    const extension = allowedTypes[file.type]
    if (!extension) return Response.json({ error: 'Formato não permitido. Use JPG, PNG ou WEBP.' }, { status: 400 })
    if (file.size <= 0 || file.size > MAX_FILE_SIZE) return Response.json({ error: 'A imagem temporária deve ter no máximo 2,8 MB.' }, { status: 413 })

    const fileName = `preco-vivo-qr-${randomUUID()}.${extension}`
    absolutePath = path.join(tmpdir(), fileName)
    await writeFile(absolutePath, new Uint8Array(await file.arrayBuffer()))

    const decodedText = await decodeQrFromImage(absolutePath)
    return Response.json({ decodedText, detectedAccessKey: accessKeyFrom(decodedText) })
  } catch (error) {
    if (error instanceof ImportFailure) {
      return Response.json({ error: error.message }, { status: 422 })
    }
    return errorResponse(error)
  } finally {
    if (absolutePath) await unlink(absolutePath).catch(() => undefined)
  }
}
