import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { requireUser } from '@/lib/auth'
import { errorResponse } from '@/lib/http'
import { prisma } from '@/lib/prisma'

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const [user, { id }] = await Promise.all([requireUser(), context.params])
    const uploaded = await prisma.uploadedFile.findFirst({ where: { id, userId: user.id } })
    if (!uploaded) return Response.json({ error: 'Arquivo não encontrado.' }, { status: 404 })

    const root = path.resolve(process.cwd(), 'storage', 'uploads')
    const absolutePath = path.resolve(root, uploaded.storagePath)
    if (!absolutePath.startsWith(`${root}${path.sep}`)) return Response.json({ error: 'Caminho de arquivo inválido.' }, { status: 400 })
    const data = await readFile(absolutePath)
    return new Response(new Uint8Array(data), {
      headers: {
        'Content-Type': uploaded.mimeType,
        'Content-Length': String(uploaded.size),
        'Content-Disposition': `inline; filename="${encodeURIComponent(uploaded.originalName)}"`,
        'Cache-Control': 'private, max-age=3600',
      },
    })
  } catch (error) {
    return errorResponse(error)
  }
}
