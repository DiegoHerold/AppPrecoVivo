// Helpers puros de árvore do Plano de Contas — sem dependência de Prisma,
// para serem testáveis isoladamente e reutilizados no backend.

export type NodeKind = 'GRUPO' | 'PRODUTO'

export type TreeRow = {
  id: string
  parentId: string | null
  tipo: NodeKind
  nome: string
}

export function indexTree<T extends TreeRow>(rows: T[]) {
  const byId = new Map<string, T>()
  const childrenByParent = new Map<string | null, T[]>()
  for (const row of rows) {
    byId.set(row.id, row)
    const list = childrenByParent.get(row.parentId) ?? []
    list.push(row)
    childrenByParent.set(row.parentId, list)
  }
  return { byId, childrenByParent }
}

export function pathOf<T extends TreeRow>(row: T, byId: Map<string, T>): T[] {
  const path: T[] = [row]
  const visited = new Set([row.id])
  let parentId = row.parentId
  while (parentId && !visited.has(parentId)) {
    visited.add(parentId)
    const parent = byId.get(parentId)
    if (!parent) break
    path.unshift(parent)
    parentId = parent.parentId
  }
  return path
}

export function descendantIds<T extends TreeRow>(rows: T[], rootId: string): Set<string> {
  const ids = new Set([rootId])
  let changed = true
  while (changed) {
    changed = false
    for (const row of rows) {
      if (row.parentId && ids.has(row.parentId) && !ids.has(row.id)) {
        ids.add(row.id)
        changed = true
      }
    }
  }
  return ids
}

/** true se mover `nodeId` para baixo de `newParentId` criaria um ciclo. */
export function wouldCreateCycle<T extends TreeRow>(byId: Map<string, T>, nodeId: string, newParentId: string | null): boolean {
  if (!newParentId) return false
  if (newParentId === nodeId) return true
  const visited = new Set<string>()
  let cursor: string | null = newParentId
  while (cursor && !visited.has(cursor)) {
    if (cursor === nodeId) return true
    visited.add(cursor)
    cursor = byId.get(cursor)?.parentId ?? null
  }
  return false
}
