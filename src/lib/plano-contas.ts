import type { BehaviorType, Prisma, PlanoContaTipo } from '@/generated/prisma/client'
import { prisma } from '@/lib/prisma'
import { descendantIds, indexTree, pathOf, type TreeRow, wouldCreateCycle } from '@/lib/plano-contas-tree'

export { descendantIds, indexTree, pathOf, wouldCreateCycle }
export type { TreeRow }

export class PlanoContaError extends Error {
  constructor(message: string, public status = 400) {
    super(message)
    this.name = 'PlanoContaError'
  }
}

const number = (value: unknown) => Number(value ?? 0)

// ---------------------------------------------------------------------------
// DTO
// ---------------------------------------------------------------------------

export type PlanoContaNodeDto = {
  id: string
  nome: string
  tipo: PlanoContaTipo
  parentId: string | null
  produtoId: string | null
  ativo: boolean
  ordem: number
  icone: string
  cor: string
  allowedUnits: string[]
  level: number
  path: string[]
  childrenCount: number
  productCount: number
  itemCount: number
  // Extras para nós PRODUTO:
  defaultUnit?: string
  brand?: string | null
  packageSize?: string | null
  behaviorType?: BehaviorType
  estimatedDurationMonths?: number
  productActive?: boolean
}

type FullRow = {
  id: string
  parentId: string | null
  tipo: PlanoContaTipo
  nome: string
  produtoId: string | null
  ativo: boolean
  ordem: number
  icone: string
  cor: string
  allowedUnits: string[]
  createdAt: Date
  _count: { items: number; children: number }
  produto: {
    defaultUnit: string
    brand: string | null
    packageSize: string | null
    behaviorType: BehaviorType
    estimatedDurationMonths: Prisma.Decimal
    active: boolean
  } | null
}

export async function listTree(userId: string, query?: string | null): Promise<PlanoContaNodeDto[]> {
  const rows = (await prisma.planoConta.findMany({
    where: { userId },
    include: {
      _count: { select: { items: true, children: true } },
      produto: {
        select: { defaultUnit: true, brand: true, packageSize: true, behaviorType: true, estimatedDurationMonths: true, active: true },
      },
    },
    orderBy: [{ ordem: 'asc' }, { nome: 'asc' }],
  })) as unknown as FullRow[]

  const treeRows: TreeRow[] = rows.map((row) => ({ id: row.id, parentId: row.parentId, tipo: row.tipo, nome: row.nome }))
  const { byId } = indexTree(treeRows)

  const nodes: PlanoContaNodeDto[] = rows.map((row) => {
    const subtree = descendantIds(treeRows, row.id)
    let productCount = 0
    let itemCount = 0
    for (const candidate of rows) {
      if (!subtree.has(candidate.id)) continue
      if (candidate.tipo === 'PRODUTO') productCount += 1
      itemCount += candidate._count.items
    }
    const path = pathOf(byId.get(row.id)!, byId)
    return {
      id: row.id,
      nome: row.nome,
      tipo: row.tipo,
      parentId: row.parentId,
      produtoId: row.produtoId,
      ativo: row.ativo,
      ordem: row.ordem,
      icone: row.icone,
      cor: row.cor,
      allowedUnits: row.allowedUnits,
      level: path.length - 1,
      path: path.map((item) => item.nome),
      childrenCount: row._count.children,
      productCount,
      itemCount,
      ...(row.tipo === 'PRODUTO' && row.produto
        ? {
            defaultUnit: row.produto.defaultUnit,
            brand: row.produto.brand,
            packageSize: row.produto.packageSize,
            behaviorType: row.produto.behaviorType,
            estimatedDurationMonths: number(row.produto.estimatedDurationMonths),
            productActive: row.produto.active,
          }
        : {}),
    }
  })

  const sorted = nodes.sort((a, b) => a.path.join(' / ').localeCompare(b.path.join(' / '), 'pt-BR'))
  if (!query?.trim()) return sorted

  const term = query.trim().toLowerCase()
  const matched = new Set<string>()
  for (const node of sorted) {
    if (node.nome.toLowerCase().includes(term)) {
      // inclui o nó e toda a sua linha ancestral para manter o contexto na árvore
      let cursor: string | null = node.id
      while (cursor && !matched.has(cursor)) {
        matched.add(cursor)
        cursor = byId.get(cursor)?.parentId ?? null
      }
    }
  }
  return sorted.filter((node) => matched.has(node.id))
}

// ---------------------------------------------------------------------------
// Operações de escrita
// ---------------------------------------------------------------------------

async function nextOrdem(tx: Prisma.TransactionClient, userId: string, parentId: string | null) {
  const last = await tx.planoConta.findFirst({
    where: { userId, parentId },
    orderBy: { ordem: 'desc' },
    select: { ordem: true },
  })
  return (last?.ordem ?? -1) + 1
}

async function requireGroup(tx: Prisma.TransactionClient, userId: string, groupId: string) {
  const group = await tx.planoConta.findFirst({ where: { id: groupId, userId } })
  if (!group) throw new PlanoContaError('Grupo não encontrado.', 404)
  if (group.tipo !== 'GRUPO') throw new PlanoContaError('Só é possível classificar dentro de um grupo.')
  return group
}

async function assertNoSiblingDuplicate(tx: Prisma.TransactionClient, userId: string, parentId: string | null, nome: string, ignoreId?: string) {
  const duplicate = await tx.planoConta.findFirst({
    where: { userId, parentId, tipo: 'GRUPO', nome: { equals: nome, mode: 'insensitive' }, id: ignoreId ? { not: ignoreId } : undefined },
    select: { id: true },
  })
  if (duplicate) throw new PlanoContaError('Já existe um grupo com esse nome neste nível.', 409)
}

export async function createGrupo(userId: string, input: {
  nome: string
  parentId?: string | null
  icone?: string
  cor?: string
  allowedUnits?: string[]
  ativo?: boolean
}) {
  return prisma.$transaction(async (tx) => {
    if (input.parentId) await requireGroup(tx, userId, input.parentId)
    await assertNoSiblingDuplicate(tx, userId, input.parentId ?? null, input.nome)
    return tx.planoConta.create({
      data: {
        userId,
        nome: input.nome,
        tipo: 'GRUPO',
        parentId: input.parentId ?? null,
        ativo: input.ativo ?? true,
        ordem: await nextOrdem(tx, userId, input.parentId ?? null),
        icone: input.icone ?? '📁',
        cor: input.cor ?? '#635BFF',
        allowedUnits: input.allowedUnits ?? ['un', 'pct', 'cx'],
      },
    })
  })
}

export type NewProductInput = {
  standardName: string
  groupId: string
  behaviorType: BehaviorType
  estimatedDurationMonths: number
  defaultUnit: string
  classificationConfirmed: boolean
  active?: boolean
  brand?: string | null
  packageSize?: string | null
}

/** Cria Product + nó PRODUTO atomicamente. Garante "1 conta por produto" via produtoId @unique. */
export async function createProdutoWithNode(tx: Prisma.TransactionClient, userId: string, input: NewProductInput) {
  const product = await tx.product.create({
    data: {
      userId,
      standardName: input.standardName,
      behaviorType: input.behaviorType,
      estimatedDurationMonths: input.estimatedDurationMonths,
      defaultUnit: input.defaultUnit,
      classificationConfirmed: input.classificationConfirmed,
      active: input.active ?? true,
      brand: input.brand || null,
      packageSize: input.packageSize || null,
    },
  })
  const node = await tx.planoConta.create({
    data: {
      userId,
      nome: product.standardName,
      tipo: 'PRODUTO',
      parentId: input.groupId,
      produtoId: product.id,
      ativo: product.active,
      ordem: await nextOrdem(tx, userId, input.groupId),
      icone: '📦',
      cor: '#10B981',
    },
  })
  return { product, node }
}

export async function createProduto(userId: string, input: {
  standardName: string
  groupId: string
  behaviorType: BehaviorType
  estimatedDurationMonths: number
  defaultUnit: string
  brand?: string | null
  packageSize?: string | null
}) {
  return prisma.$transaction(async (tx) => {
    const group = await requireGroup(tx, userId, input.groupId)
    if (!group.ativo) throw new PlanoContaError('Esse grupo está inativo.')
    if (!group.allowedUnits.includes(input.defaultUnit)) {
      throw new PlanoContaError('A unidade escolhida não está habilitada nesse grupo.')
    }
    const duplicate = await tx.product.findFirst({
      where: { userId, standardName: { equals: input.standardName, mode: 'insensitive' } },
      select: { id: true },
    })
    if (duplicate) throw new PlanoContaError('Já existe um produto com esse nome.', 409)
    const { node } = await createProdutoWithNode(tx, userId, {
      ...input,
      classificationConfirmed: true,
      active: true,
    })
    return node
  })
}

export async function updateNode(userId: string, id: string, input: {
  nome?: string
  icone?: string
  cor?: string
  allowedUnits?: string[]
  ativo?: boolean
}) {
  return prisma.$transaction(async (tx) => {
    const node = await tx.planoConta.findFirst({ where: { id, userId } })
    if (!node) throw new PlanoContaError('Item não encontrado.', 404)
    if (input.nome && input.nome !== node.nome && node.tipo === 'GRUPO') {
      await assertNoSiblingDuplicate(tx, userId, node.parentId, input.nome, id)
    }
    const updated = await tx.planoConta.update({
      where: { id },
      data: {
        nome: input.nome ?? undefined,
        icone: input.icone ?? undefined,
        cor: input.cor ?? undefined,
        allowedUnits: node.tipo === 'GRUPO' ? input.allowedUnits ?? undefined : undefined,
        ativo: input.ativo ?? undefined,
      },
    })
    // Nó PRODUTO espelha nome/ativo no Product (fonte de verdade do produto).
    if (node.tipo === 'PRODUTO' && node.produtoId && (input.nome !== undefined || input.ativo !== undefined)) {
      await tx.product.update({
        where: { id: node.produtoId },
        data: {
          standardName: input.nome ?? undefined,
          active: input.ativo ?? undefined,
        },
      })
    }
    return updated
  })
}

export async function moveNode(userId: string, id: string, input: { parentId: string | null; ordem?: number }) {
  return prisma.$transaction(async (tx) => {
    const node = await tx.planoConta.findFirst({ where: { id, userId } })
    if (!node) throw new PlanoContaError('Item não encontrado.', 404)
    if (node.tipo === 'PRODUTO' && !input.parentId) {
      throw new PlanoContaError('Um produto precisa pertencer a um grupo.')
    }
    if (input.parentId) {
      await requireGroup(tx, userId, input.parentId)
      const rows = await tx.planoConta.findMany({ where: { userId }, select: { id: true, parentId: true, tipo: true, nome: true } })
      const { byId } = indexTree(rows)
      if (wouldCreateCycle(byId, id, input.parentId)) {
        throw new PlanoContaError('Esse movimento criaria um ciclo na árvore.')
      }
    }
    return tx.planoConta.update({
      where: { id },
      data: {
        parentId: input.parentId,
        ordem: input.ordem ?? (await nextOrdem(tx, userId, input.parentId)),
      },
    })
  })
}

/** Inativa (padrão) o nó e toda a sua subárvore. Exclui de vez somente se vazio e hard=true. */
export async function removeNode(userId: string, id: string, hard = false) {
  return prisma.$transaction(async (tx) => {
    const node = await tx.planoConta.findFirst({
      where: { id, userId },
      include: { _count: { select: { items: true, children: true } } },
    })
    if (!node) throw new PlanoContaError('Item não encontrado.', 404)

    if (hard) {
      if (node._count.children || node._count.items) {
        throw new PlanoContaError('Esse item possui subníveis ou histórico. Inative-o em vez de excluir.', 409)
      }
      if (node.tipo === 'PRODUTO' && node.produtoId) {
        await tx.product.delete({ where: { id: node.produtoId } }) // cascade remove o nó
      } else {
        await tx.planoConta.delete({ where: { id } })
      }
      return { deleted: true }
    }

    const rows = await tx.planoConta.findMany({ where: { userId }, select: { id: true, parentId: true, tipo: true, nome: true, produtoId: true } })
    const subtree = descendantIds(rows, id)
    const ids = [...subtree]
    await tx.planoConta.updateMany({ where: { id: { in: ids } }, data: { ativo: false } })
    const produtoIds = rows.filter((row) => subtree.has(row.id) && row.produtoId).map((row) => row.produtoId as string)
    if (produtoIds.length) {
      await tx.product.updateMany({ where: { id: { in: produtoIds } }, data: { active: false } })
    }
    return { deactivated: ids.length }
  })
}
