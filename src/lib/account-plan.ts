import { prisma } from '@/lib/prisma'

export class AccountPlanError extends Error {
  constructor(message: string, public status = 400) {
    super(message)
    this.name = 'AccountPlanError'
  }
}

type CategoryRow = {
  id: string
  parentId: string | null
  name: string
}

function categoryPath(row: CategoryRow, byId: Map<string, CategoryRow>) {
  const path = [row.name]
  let parentId = row.parentId
  const visited = new Set([row.id])
  while (parentId) {
    if (visited.has(parentId)) break
    visited.add(parentId)
    const parent = byId.get(parentId)
    if (!parent) break
    path.unshift(parent.name)
    parentId = parent.parentId
  }
  return path
}

export async function listAccountPlan(userId: string) {
  const rows = await prisma.category.findMany({
    where: { userId },
    include: { _count: { select: { children: true, products: true, items: true } } },
    orderBy: [{ createdAt: 'asc' }, { name: 'asc' }],
  })
  const byId = new Map(rows.map((row) => [row.id, row]))
  return rows.map((row) => {
    const path = categoryPath(row, byId)
    return {
      id: row.id,
      parentId: row.parentId,
      name: row.name,
      icon: row.icon,
      color: row.color,
      allowedUnits: row.allowedUnits,
      active: row.active,
      level: path.length - 1,
      path,
      childrenCount: row._count.children,
      productCount: row._count.products,
      itemCount: row._count.items,
    }
  }).sort((a, b) => a.path.join(' / ').localeCompare(b.path.join(' / '), 'pt-BR'))
}

async function validateParent(userId: string, parentId: string | null | undefined, currentId?: string) {
  if (!parentId) return null
  if (parentId === currentId) throw new AccountPlanError('Uma classificação não pode ser pai dela mesma.')
  const rows = await prisma.category.findMany({ where: { userId }, select: { id: true, parentId: true, name: true } })
  const byId = new Map(rows.map((row) => [row.id, row]))
  const parent = byId.get(parentId)
  if (!parent) throw new AccountPlanError('Classificação superior não encontrada.', 404)
  let cursor: CategoryRow | undefined = parent
  while (cursor) {
    if (cursor.id === currentId) throw new AccountPlanError('Esse movimento criaria uma classificação circular.')
    cursor = cursor.parentId ? byId.get(cursor.parentId) : undefined
  }
  return parent
}

export async function createAccountCategory(userId: string, input: { name: string; icon: string; color: string; parentId?: string | null; allowedUnits: string[]; active?: boolean }) {
  await validateParent(userId, input.parentId)
  const duplicate = await prisma.category.findFirst({ where: { userId, name: { equals: input.name, mode: 'insensitive' } }, select: { id: true } })
  if (duplicate) throw new AccountPlanError('Já existe uma classificação com esse nome.', 409)
  return prisma.category.create({
    data: { userId, name: input.name, icon: input.icon, color: input.color, parentId: input.parentId || null, allowedUnits: input.allowedUnits, active: input.active ?? true },
  })
}

export async function updateAccountCategory(userId: string, categoryId: string, input: { name?: string; icon?: string; color?: string; parentId?: string | null; allowedUnits?: string[]; active?: boolean }) {
  const current = await prisma.category.findFirst({ where: { id: categoryId, userId }, select: { id: true } })
  if (!current) throw new AccountPlanError('Classificação não encontrada.', 404)
  if (input.parentId !== undefined) await validateParent(userId, input.parentId, categoryId)
  if (input.name) {
    const duplicate = await prisma.category.findFirst({ where: { userId, id: { not: categoryId }, name: { equals: input.name, mode: 'insensitive' } }, select: { id: true } })
    if (duplicate) throw new AccountPlanError('Já existe uma classificação com esse nome.', 409)
  }
  return prisma.category.update({ where: { id: categoryId }, data: input })
}

export async function deleteAccountCategory(userId: string, categoryId: string) {
  const category = await prisma.category.findFirst({
    where: { id: categoryId, userId },
    include: { _count: { select: { children: true, products: true, items: true } } },
  })
  if (!category) throw new AccountPlanError('Classificação não encontrada.', 404)
  if (category._count.children || category._count.products || category._count.items) {
    throw new AccountPlanError('Essa classificação possui subníveis ou histórico. Desative-a em vez de excluir.', 409)
  }
  await prisma.category.delete({ where: { id: categoryId } })
  return { deleted: true }
}
