import { prisma } from '@/lib/prisma'
import {
  calculateEstimatedConsumption,
  calculateMonthlyFlow,
  detectOutOfPatternProducts,
  explainMonthlyDifference,
  type FlowItem,
} from '@/lib/domain'
import { loadFlowItems, recalculateMonthlyFlow } from '@/lib/monthly-flow'

type PlanRow = {
  id: string
  parentId: string | null
  name: string
  icon: string
  color: string
  allowedUnits: string[]
  active: boolean
  createdAt: Date
}

const round = (value: number) => Math.round(value * 100) / 100

function monthName(year: number, month: number) {
  return new Intl.DateTimeFormat('pt-BR', { month: 'long', timeZone: 'UTC' })
    .format(new Date(Date.UTC(year, month - 1, 1)))
    .replace(/^./, (letter) => letter.toUpperCase())
}

function previousMonth(year: number, month: number) {
  const date = new Date(Date.UTC(year, month - 2, 1))
  return { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1 }
}

function descendants(rows: PlanRow[], rootId: string) {
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

function pathTo(row: PlanRow, byId: Map<string, PlanRow>) {
  const path = [row]
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

function scoped(items: FlowItem[], categoryIds: Set<string>) {
  return items.filter((item) => Boolean(item.categoryId && categoryIds.has(item.categoryId)))
}

function spent(items: FlowItem[]) {
  return items.reduce((sum, item) => sum + item.totalPrice, 0)
}

function consumed(items: FlowItem[]) {
  return items.reduce((sum, item) => sum + calculateEstimatedConsumption(item), 0)
}

export async function getClassificationDashboard(userId: string, year: number, month: number, categoryId?: string | null) {
  const previous = previousMonth(year, month)
  await recalculateMonthlyFlow(userId, year, month)
  const [currentItems, previousItems, categoryRows] = await Promise.all([
    loadFlowItems(userId, year, month),
    loadFlowItems(userId, previous.year, previous.month),
    prisma.category.findMany({ where: { userId }, orderBy: { createdAt: 'asc' } }),
  ])
  const rows: PlanRow[] = categoryRows
  const byId = new Map(rows.map((row) => [row.id, row]))
  const selected = categoryId ? byId.get(categoryId) : undefined
  if (categoryId && !selected) throw new Error('Classificação não encontrada.')
  const scopeIds = selected ? descendants(rows, selected.id) : new Set(rows.map((row) => row.id))
  const current = scoped(currentItems, scopeIds)
  const before = scoped(previousItems, scopeIds)
  const flow = calculateMonthlyFlow(current, before)
  const outOfPattern = detectOutOfPatternProducts(current, before)

  const categories = rows.map((category) => {
    const ids = descendants(rows, category.id)
    const categoryItems = scoped(currentItems, ids)
    const priorItems = scoped(previousItems, ids)
    const total = spent(categoryItems)
    const consumption = consumed(categoryItems)
    const path = pathTo(category, byId)
    return {
      id: category.id,
      parentId: category.parentId,
      name: category.name,
      icon: category.icon,
      color: category.color,
      allowedUnits: category.allowedUnits,
      active: category.active,
      level: path.length - 1,
      path: path.map((item) => item.name),
      totalSpent: round(total),
      estimatedConsumption: round(consumption),
      stockAmount: round(total - consumption),
      variation: round(total - spent(priorItems)),
      productCount: new Set(categoryItems.map((item) => item.key)).size,
    }
  }).sort((a, b) => a.path.join(' / ').localeCompare(b.path.join(' / '), 'pt-BR'))
  const categoryById = new Map(categories.map((category) => [category.id, category]))

  const dates = Array.from({ length: 6 }, (_value, index) => new Date(Date.UTC(year, month - 6 + index, 1)))
  const monthlyItems = await Promise.all(dates.map((date) => loadFlowItems(userId, date.getUTCFullYear(), date.getUTCMonth() + 1)))
  const history = dates.map((date, index) => {
    const items = scoped(monthlyItems[index], scopeIds)
    return {
      label: monthName(date.getUTCFullYear(), date.getUTCMonth() + 1).slice(0, 3),
      month: date.getUTCMonth() + 1,
      year: date.getUTCFullYear(),
      totalSpent: round(spent(items)),
      estimatedConsumption: round(consumed(items)),
    }
  })

  const groups = new Map<string, { name: string; amount: number; prices: number[]; unit: string; purchases: Set<string> }>()
  const hasChildren = rows.some((row) => row.parentId === (selected?.id ?? null))
  const productItems = hasChildren ? selected ? current.filter((item) => item.categoryId === selected.id) : [] : current
  for (const item of productItems) {
    const group = groups.get(item.key) ?? {
      name: item.name,
      amount: 0,
      prices: [],
      unit: item.unit ?? 'un',
      purchases: new Set<string>(),
    }
    group.amount += item.totalPrice
    group.prices.push(item.unitPrice)
    if (item.purchaseId) group.purchases.add(item.purchaseId)
    groups.set(item.key, group)
  }

  const insights: { id: string; type: string; title: string; description: string; amount: number }[] = explainMonthlyDifference(current, before)
    .filter((item) => item.amount > 0.009)
    .map((item, index) => ({
      id: (selected?.id ?? 'all') + '-' + item.type + '-' + index,
      type: item.type,
      title: item.title,
      description: item.description,
      amount: round(item.amount),
    }))
  if (outOfPattern.length) {
    insights.push({
      id: (selected?.id ?? 'all') + '-fora-do-padrao',
      type: 'fora_do_padrao',
      title: 'Produtos fora do padrão',
      description: String(outOfPattern.length) + (outOfPattern.length === 1 ? ' produto saiu' : ' produtos saíram') + ' do seu padrão neste mês.',
      amount: round(outOfPattern.reduce((sum, item) => sum + item.totalPrice, 0)),
    })
  }

  const children = categories
    .filter((category) => category.parentId === (selected?.id ?? null) && (category.active || category.totalSpent > 0))
    .sort((a, b) => b.totalSpent - a.totalSpent || a.name.localeCompare(b.name, 'pt-BR'))

  return {
    year,
    month,
    monthLabel: monthName(year, month),
    previousMonthLabel: monthName(previous.year, previous.month),
    totalSpent: round(flow.totalSpent),
    previousTotalSpent: round(flow.previousTotalSpent),
    difference: round(flow.totalSpent - flow.previousTotalSpent),
    estimatedConsumption: round(flow.estimatedConsumption),
    stockAmount: round(flow.stockAmount),
    recurringAmount: round(flow.recurringAmount),
    punctualAmount: round(flow.punctualAmount),
    priceIncreaseAmount: round(flow.priceIncreaseAmount),
    quantityIncreaseAmount: round(flow.quantityIncreaseAmount),
    purchaseCount: new Set(current.flatMap((item) => item.purchaseId ? [item.purchaseId] : [])).size,
    categories,
    history,
    insights,
    outOfPattern: outOfPattern.map((item) => ({ name: item.name, amount: item.totalPrice, behaviorType: item.behaviorType })),
    classification: {
      selected: selected ? categoryById.get(selected.id) ?? null : null,
      breadcrumbs: selected ? pathTo(selected, byId).map((row) => ({ id: row.id, name: row.name, icon: row.icon, color: row.color })) : [],
      children,
      products: Array.from(groups.entries()).map(([id, group]) => ({
        id,
        name: group.name,
        amount: round(group.amount),
        purchaseCount: group.purchases.size,
        averageUnitPrice: round(group.prices.reduce((sum, price) => sum + price, 0) / Math.max(1, group.prices.length)),
        unit: group.unit,
      })).sort((a, b) => b.amount - a.amount),
    },
  }
}
