import { compare } from 'bcryptjs'
import { createSession, getPublicUserById } from '@/lib/auth'
import { errorResponse } from '@/lib/http'
import { prisma } from '@/lib/prisma'
import { loginSchema } from '@/lib/validation'

export async function POST(request: Request) {
  try {
    const input = loginSchema.parse(await request.json())
    const user = await prisma.user.findUnique({ where: { email: input.email } })
    if (!user || !(await compare(input.password, user.passwordHash))) {
      return Response.json({ error: 'E-mail ou senha inválidos.' }, { status: 401 })
    }
    await createSession(user.id)
    return Response.json({ user: await getPublicUserById(user.id) })
  } catch (error) {
    return errorResponse(error)
  }
}
