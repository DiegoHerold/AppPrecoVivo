import { hash } from 'bcryptjs'
import { createSession, getPublicUserById } from '@/lib/auth'
import { createInitialPlanoContas } from '@/lib/plano-contas-seed'
import { errorResponse } from '@/lib/http'
import { prisma } from '@/lib/prisma'
import { registerSchema } from '@/lib/validation'

export async function POST(request: Request) {
  try {
    const input = registerSchema.parse(await request.json())
    const duplicate = await prisma.user.findUnique({ where: { email: input.email }, select: { id: true } })
    if (duplicate) return Response.json({ error: 'Este e-mail já está cadastrado.' }, { status: 409 })
    const passwordHash = await hash(input.password, 12)
    const user = await prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: { name: input.name, email: input.email, passwordHash, settings: { create: {} } },
        select: { id: true },
      })
      await createInitialPlanoContas(tx, created.id)
      return created
    })
    await createSession(user.id)
    return Response.json({ user: await getPublicUserById(user.id) }, { status: 201 })
  } catch (error) {
    return errorResponse(error)
  }
}
