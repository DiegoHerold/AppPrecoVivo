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
    include: {
      _count: { select: { children: true, products: true, items: true } },
      productAccounts: {
        include: {
          product: { select: { active: true, defaultUnit: true, behaviorType: true } },
          _count: { select: { items: true } },
        },
        orderBy: [{ ordem: 'asc' }, { name: 'asc' }],
      },
    },
    orderBy: [{ ordem: 'asc' }, { name: 'asc' }],
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
      ordem: row.ordem,
      active: row.active,
      level: path.length - 1,
      path,
      childrenCount: row._count.children,
      productCount: row.productAccounts.length,
      itemCount: row._count.items,
      accounts: row.productAccounts.map((account) => ({
        id: account.id,
        productId: account.productId,
        name: account.name,
        type: account.type,
        categoryId: account.categoryId,
        ordem: account.ordem,
        active: account.active,
        createdAt: account.createdAt.toISOString(),
        itemCount: account._count.items,
        defaultUnit: account.product.defaultUnit,
        behaviorType: account.product.behaviorType,
        productActive: account.product.active,
      })),
    }
  }).sort((a, b) => {
    // Sort by tree position: compare path segments pairwise using ordem
    const aPath = a.path
    const bPath = b.path
    const minLen = Math.min(aPath.length, bPath.length)
    for (let i = 0; i < minLen; i++) {
      if (aPath[i] !== bPath[i]) return aPath[i].localeCompare(bPath[i], 'pt-BR')
    }
    return aPath.length - bPath.length
  })
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

export async function createAccountCategory(userId: string, input: {
  name: string; icon: string; color: string; parentId?: string | null
  allowedUnits: string[]; active?: boolean; ordem?: number
}) {
  await validateParent(userId, input.parentId)
  const duplicate = await prisma.category.findFirst({ where: { userId, name: { equals: input.name, mode: 'insensitive' } }, select: { id: true } })
  if (duplicate) throw new AccountPlanError('Já existe uma classificação com esse nome.', 409)

  let ordem = input.ordem ?? 0
  if (input.ordem === undefined) {
    // Place at the end of siblings
    const maxOrdem = await prisma.category.aggregate({
      where: { userId, parentId: input.parentId || null },
      _max: { ordem: true },
    })
    ordem = (maxOrdem._max.ordem ?? -1) + 1
  }

  return prisma.category.create({
    data: {
      userId, name: input.name, icon: input.icon, color: input.color,
      parentId: input.parentId || null, allowedUnits: input.allowedUnits,
      active: input.active ?? true, ordem,
    },
  })
}

export async function updateAccountCategory(userId: string, categoryId: string, input: {
  name?: string; icon?: string; color?: string; parentId?: string | null
  allowedUnits?: string[]; active?: boolean; ordem?: number
}) {
  const current = await prisma.category.findFirst({ where: { id: categoryId, userId }, select: { id: true } })
  if (!current) throw new AccountPlanError('Classificação não encontrada.', 404)
  if (input.parentId !== undefined) await validateParent(userId, input.parentId, categoryId)
  if (input.name) {
    const duplicate = await prisma.category.findFirst({
      where: { userId, id: { not: categoryId }, name: { equals: input.name, mode: 'insensitive' } }, select: { id: true }
    })
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

export async function reorderAccountPlan(userId: string, input: {
  categories?: Array<{ id: string; ordem: number; parentId?: string | null }>
  accounts?: Array<{ id: string; ordem: number }>
}) {
  const ops: Promise<unknown>[] = []

  if (input.categories?.length) {
    // Validate all belong to user
    const ids = input.categories.map((c) => c.id)
    const found = await prisma.category.findMany({ where: { id: { in: ids }, userId }, select: { id: true } })
    const foundIds = new Set(found.map((c) => c.id))
    for (const c of input.categories) {
      if (!foundIds.has(c.id)) throw new AccountPlanError(`Classificação ${c.id} não encontrada.`, 404)
    }
    // Validate no cycles for parentId changes
    for (const c of input.categories) {
      if (c.parentId !== undefined) await validateParent(userId, c.parentId, c.id)
    }
    for (const c of input.categories) {
      const data: { ordem: number; parentId?: string | null } = { ordem: c.ordem }
      if (c.parentId !== undefined) data.parentId = c.parentId
      ops.push(prisma.category.update({ where: { id: c.id }, data }))
    }
  }

  if (input.accounts?.length) {
    const ids = input.accounts.map((a) => a.id)
    const found = await prisma.productAccount.findMany({ where: { id: { in: ids }, userId }, select: { id: true } })
    const foundIds = new Set(found.map((a) => a.id))
    for (const a of input.accounts) {
      if (!foundIds.has(a.id)) throw new AccountPlanError(`Conta ${a.id} não encontrada.`, 404)
    }
    for (const a of input.accounts) {
      ops.push(prisma.productAccount.update({ where: { id: a.id }, data: { ordem: a.ordem } }))
    }
  }

  await Promise.all(ops)
  return { ok: true }
}

export async function moveProductAccount(userId: string, accountId: string, targetCategoryId: string) {
  const account = await prisma.productAccount.findFirst({
    where: { id: accountId, userId },
    include: { product: true },
  })
  if (!account) throw new AccountPlanError('Conta não encontrada.', 404)

  const targetCategory = await prisma.category.findFirst({
    where: { id: targetCategoryId, userId, active: true },
    select: { id: true, allowedUnits: true },
  })
  if (!targetCategory) throw new AccountPlanError('Classificação de destino não encontrada ou desativada.', 404)

  if (!targetCategory.allowedUnits.includes(account.product.defaultUnit)) {
    throw new AccountPlanError(
      `A unidade "${account.product.defaultUnit}" não está habilitada na classificação de destino.`
    )
  }

  // Compute new ordem (end of target category)
  const maxOrdem = await prisma.productAccount.aggregate({
    where: { userId, categoryId: targetCategoryId },
    _max: { ordem: true },
  })
  const ordem = (maxOrdem._max.ordem ?? -1) + 1

  // Update product categoryId → trigger will sync ProductAccount.categoryId automatically
  await prisma.product.update({
    where: { id: account.productId },
    data: { categoryId: targetCategoryId },
  })
  // Also update ordem manually (trigger doesn't set it)
  await prisma.productAccount.update({
    where: { id: accountId },
    data: { ordem },
  })

  return { ok: true }
}
