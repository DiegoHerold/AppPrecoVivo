import 'server-only'

import { createHash, randomBytes } from 'node:crypto'
import { cookies } from 'next/headers'
import { prisma } from '@/lib/prisma'

const COOKIE_NAME = 'fluxo_session'
const SESSION_DAYS = 30

const publicUserSelect = {
  id: true,
  name: true,
  email: true,
  phone: true,
  city: true,
  state: true,
  createdAt: true,
  settings: {
    select: {
      theme: true,
      cameraFacingMode: true,
      notificationsEnabled: true,
      monthlySummaryEnabled: true,
      priceAlertsEnabled: true,
      compactMode: true,
    },
  },
} as const

function hashToken(token: string) {
  return createHash('sha256').update(token).digest('hex')
}

export async function createSession(userId: string) {
  const token = randomBytes(32).toString('base64url')
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000)

  await prisma.session.create({
    data: { userId, tokenHash: hashToken(token), expiresAt },
  })

  const store = await cookies()
  store.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    expires: expiresAt,
    priority: 'high',
  })
}

export async function deleteSession() {
  const store = await cookies()
  const token = store.get(COOKIE_NAME)?.value
  if (token) {
    await prisma.session.deleteMany({ where: { tokenHash: hashToken(token) } })
  }
  store.delete(COOKIE_NAME)
}

export async function getCurrentUser() {
  const token = (await cookies()).get(COOKIE_NAME)?.value
  if (!token) return null

  const session = await prisma.session.findFirst({
    where: { tokenHash: hashToken(token), expiresAt: { gt: new Date() } },
    select: {
      id: true,
      user: { select: publicUserSelect },
    },
  })

  return session?.user ?? null
}

export async function getPublicUserById(userId: string) {
  return prisma.user.findUniqueOrThrow({ where: { id: userId }, select: publicUserSelect })
}

export async function requireUser() {
  const user = await getCurrentUser()
  if (!user) throw new Error('UNAUTHORIZED')
  return user
}

export function unauthorizedResponse() {
  return Response.json({ error: 'Faça login para continuar.' }, { status: 401 })
}
