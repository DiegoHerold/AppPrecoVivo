import 'dotenv/config'
import { hash } from 'bcryptjs'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '../src/generated/prisma/client'
import { createInitialCategories, INITIAL_CATEGORIES } from '../src/lib/categories'

const connectionString = process.env.DATABASE_URL
if (!connectionString) throw new Error('DATABASE_URL não configurada.')

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) })

async function main() {
  const email = (process.env.DEV_USER_EMAIL ?? 'dev@fluxo.local').toLowerCase()
  const passwordHash = await hash(process.env.DEV_USER_PASSWORD ?? 'Dev12345!', 12)
  const user = await prisma.user.upsert({
    where: { email },
    update: {},
    create: { name: 'Usuário de desenvolvimento', email, passwordHash },
  })
  await prisma.userSettings.upsert({
    where: { userId: user.id },
    update: {},
    create: { userId: user.id },
  })
  await prisma.$transaction((tx) => createInitialCategories(tx, user.id))
  console.log(`Seed estrutural concluído para ${email}: ${INITIAL_CATEGORIES.length} categorias, nenhuma compra.`)
}

main().finally(() => prisma.$disconnect())
