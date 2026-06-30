import 'server-only'

import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '@/generated/prisma/client'
import { resolveRuntimeDatabaseConnectionString } from '@/lib/postgres-connection'

const connectionString = resolveRuntimeDatabaseConnectionString(process.env)

if (!connectionString) {
  throw new Error('DATABASE_URL não foi configurada.')
}

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient }

function createPrismaClient() {
  const adapter = new PrismaPg({ connectionString })
  return new PrismaClient({ adapter })
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma

