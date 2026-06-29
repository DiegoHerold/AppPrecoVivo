import { compare, hash } from 'bcryptjs'
import { requireUser } from '@/lib/auth'
import { errorResponse } from '@/lib/http'
import { prisma } from '@/lib/prisma'
import { passwordChangeSchema } from '@/lib/validation'

export async function POST(request: Request) {
  try {
    const [user, input] = await Promise.all([requireUser(), request.json().then((body) => passwordChangeSchema.parse(body))])
    const account = await prisma.user.findUniqueOrThrow({ where: { id: user.id }, select: { passwordHash: true } })
    if (!(await compare(input.currentPassword, account.passwordHash))) {
      return Response.json({ error: 'A senha atual não confere.' }, { status: 400 })
    }
    await prisma.user.update({ where: { id: user.id }, data: { passwordHash: await hash(input.newPassword, 12) } })
    return Response.json({ ok: true })
  } catch (error) {
    return errorResponse(error)
  }
}
