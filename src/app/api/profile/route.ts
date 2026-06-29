import { getPublicUserById, requireUser } from '@/lib/auth'
import { errorResponse } from '@/lib/http'
import { prisma } from '@/lib/prisma'
import { profileSchema } from '@/lib/validation'

export async function GET() {
  try {
    const user = await requireUser()
    return Response.json({ user: await getPublicUserById(user.id) })
  } catch (error) {
    return errorResponse(error)
  }
}

export async function PATCH(request: Request) {
  try {
    const [user, input] = await Promise.all([requireUser(), request.json().then((body) => profileSchema.parse(body))])
    const duplicate = await prisma.user.findFirst({
      where: { email: input.email, id: { not: user.id } },
      select: { id: true },
    })
    if (duplicate) return Response.json({ error: 'Este e-mail já está em uso.' }, { status: 409 })

    await prisma.$transaction([
      prisma.user.update({
        where: { id: user.id },
        data: {
          name: input.name,
          email: input.email,
          phone: input.phone || null,
          city: input.city || null,
          state: input.state || null,
        },
      }),
      prisma.userSettings.upsert({
        where: { userId: user.id },
        update: input.settings,
        create: { userId: user.id, ...input.settings },
      }),
    ])

    return Response.json({ user: await getPublicUserById(user.id) })
  } catch (error) {
    return errorResponse(error)
  }
}
