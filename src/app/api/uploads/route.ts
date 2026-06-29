import { randomUUID } from 'node:crypto'
import { mkdir, unlink, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { requireUser } from '@/lib/auth'
import { errorResponse } from '@/lib/http'
import { prisma } from '@/lib/prisma'

const allowedTypes: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'application/pdf': 'pdf',
}
const MAX_FILE_SIZE = 10 * 1024 * 1024

export async function POST(request: Request) {
  let absolutePath = ''
  try {
    const user = await requireUser()
    const form = await request.formData()
    const file = form.get('file')
    if (!(file instanceof File)) return Response.json({ error: 'Selecione uma foto ou PDF.' }, { status: 400 })
    const extension = allowedTypes[file.type]
    if (!extension) return Response.json({ error: 'Formato não permitido. Use JPG, PNG, WEBP ou PDF.' }, { status: 400 })
    if (file.size <= 0 || file.size > MAX_FILE_SIZE) return Response.json({ error: 'O arquivo deve ter no máximo 10 MB.' }, { status: 400 })

    const fileName = `${randomUUID()}.${extension}`
    const storagePath = path.posix.join(user.id, fileName)
    const directory = path.join(process.cwd(), 'storage', 'uploads', user.id)
    absolutePath = path.join(directory, fileName)
    await mkdir(directory, { recursive: true })
    await writeFile(absolutePath, new Uint8Array(await file.arrayBuffer()))

    const uploaded = await prisma.uploadedFile.create({
      data: { userId: user.id, originalName: file.name || fileName, mimeType: file.type, size: file.size, storagePath },
      select: { id: true, originalName: true, mimeType: true, size: true },
    })
    return Response.json({ upload: { ...uploaded, url: `/api/uploads/${uploaded.id}` } }, { status: 201 })
  } catch (error) {
    if (absolutePath) await unlink(absolutePath).catch(() => undefined)
    return errorResponse(error)
  }
}
