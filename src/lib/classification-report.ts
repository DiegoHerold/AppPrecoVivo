import type { PlanoContaTipo } from '@/generated/prisma/client'
import { prisma } from '@/lib/prisma'
import {
  calculateEstimatedConsumption,
  calculateMonthlyFlow,
  detectOutOfPatternProducts,
  type FlowItem,
} from '@/lib/domain'
import {
  analyzeFlowVariation,
  flowComparisonWindow,
  itemsInRange,
  scopeFlowItems,
} from '@/lib/flow-analysis'
import { loadFlowItemsRange } from '@/lib/monthly-flow'
import { descendantIds, indexTree, pathOf } from '@/lib/plano-contas-tree'

type PlanRow = {
  id: string
  parentId: string | null
  tipo: PlanoContaTipo
  nome: string
  icone: string
  cor: string
  allowedUnits: string[]
  ativo: boolean
  produtoId: string | null
  createdAt: Date
}

const round = (value: number) => Math.round(value * 100) / 100
const roundTo = (value: number, digits: number) => Math.round(value * 10 ** digits) / 10 ** digits

function monthName(year: number, month: number) {
  return new Intl.DateTimeFormat('pt-BR', { month: 'long', timeZone: 'UTC' })
    .format(new Date(Date.UTC(year, month - 1, 1)))
    .replace(/^./, (letter) => letter.toUpperCase())
}

function spent(items: FlowItem[]) {
  return items.reduce((sum, item) => sum + item.totalPrice, 0)
}

function consumed(items: FlowItem[]) {
  return items.reduce((sum, item) => sum + calculateEstimatedConsumption(item), 0)
}

function ratio(value: number, total: number) {
  return total ? Math.round(value / total * 100) : 0
}

function variationPercentage(current: number, previous: number) {
  return previous ? roundTo((current - previous) / previous * 100, 1) : null
}

function relevantAttentionEvents(productIds: string[], userId: string, start: Date, end: Date) {
  if (!productIds.length) return Promise.resolve([])
  return prisma.inferenceEventLog.findMany({
    where: {
      userId,
      productId: { in: productIds },
      occurredAt: { gte: start, lt: end },
      type: { in: ['possivel_periodo_sem_produto', 'compra_antecipada', 'compra_grande_volume', 'consumo_aumentando'] },
    },
    include: { product: { select: { standardName: true } } },
    orderBy: { occurredAt: 'desc' },
    take: 12,
  })
}

export async function getClassificationDashboard(
  userId: string,
  year: number,
  month: number,
  categoryId?: string | null,
  asOf: Date = new Date(),
  reference?: { year: number; month: number },
) {
  const comparisonWindow = flowComparisonWindow(year, month, asOf, reference)
  const historyDates = Array.from(
    { length: 12 },
    (_value, index) => new Date(Date.UTC(year, month - 12 + index, 1)),
  )
  const rangeStart = historyDates[0] < comparisonWindow.referenceStart
    ? historyDates[0]
    : comparisonWindow.referenceStart
  const selectedNaturalEnd = new Date(Date.UTC(year, month, 1))
  const rangeEnd = comparisonWindow.referenceEnd > selectedNaturalEnd
    ? comparisonWindow.referenceEnd
    : selectedNaturalEnd

  // GET permanece leitura pura: os snapshots persistidos são atualizados nas
  // mutações de compra/produto, enquanto este relatório deriva sua resposta
  // diretamente das compras imutáveis.
  const [allItems, planRows] = await Promise.all([
    loadFlowItemsRange(userId, rangeStart, rangeEnd),
    prisma.planoConta.findMany({
      where: { userId },
      select: {
        id: true,
        parentId: true,
        tipo: true,
        nome: true,
        icone: true,
        cor: true,
        allowedUnits: true,
        ativo: true,
        produtoId: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'asc' },
    }),
  ])

  const rows = planRows as PlanRow[]
  const { byId } = indexTree(rows)
  const selected = categoryId ? byId.get(categoryId) : undefined
  if (categoryId && (!selected || selected.tipo !== 'GRUPO')) {
    throw new Error('Classificação não encontrada.')
  }

  const scopeIds = selected
    ? descendantIds(rows, selected.id)
    : new Set(rows.map((row) => row.id))
  const selectedPeriodItems = itemsInRange(allItems, comparisonWindow.selectedStart, comparisonWindow.selectedEnd)
  const referencePeriodItems = itemsInRange(allItems, comparisonWindow.referenceStart, comparisonWindow.referenceEnd)
  const current = scopeFlowItems(selectedPeriodItems, scopeIds)
  const before = scopeFlowItems(referencePeriodItems, scopeIds)
  const flow = calculateMonthlyFlow(current, before)
  const variation = analyzeFlowVariation(current, before)
  const outOfPattern = detectOutOfPatternProducts(current, before)

  const groups = rows.filter((row) => row.tipo === 'GRUPO')
  const categories = groups.map((group) => {
    const ids = descendantIds(rows, group.id)
    const groupItems = scopeFlowItems(selectedPeriodItems, ids)
    const priorItems = scopeFlowItems(referencePeriodItems, ids)
    const total = spent(groupItems)
    const previousTotal = spent(priorItems)
    const path = pathOf(group, byId)
    return {
      id: group.id,
      parentId: group.parentId,
      name: group.nome,
      icon: group.icone,
      color: group.cor,
      allowedUnits: group.allowedUnits,
      active: group.ativo,
      level: path.length - 1,
      path: path.map((item) => item.nome),
      totalSpent: round(total),
      previousTotalSpent: round(previousTotal),
      estimatedConsumption: round(consumed(groupItems)),
      stockAmount: round(total - consumed(groupItems)),
      variation: round(total - previousTotal),
      variationPercentage: variationPercentage(total, previousTotal),
      shareOfTotal: ratio(total, flow.totalSpent),
      contributionToChange: variation.difference ? round((total - previousTotal) / variation.difference * 100) : 0,
      productCount: new Set(groupItems.map((item) => item.key)).size,
    }
  }).sort((left, right) => left.path.join(' / ').localeCompare(right.path.join(' / '), 'pt-BR'))
  const categoryById = new Map(categories.map((category) => [category.id, category]))

  const history = historyDates.map((date) => {
    const historyStart = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1))
    const naturalEnd = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1))
    const isSelectedMonth = date.getUTCFullYear() === year && date.getUTCMonth() + 1 === month
    const historyEnd = isSelectedMonth ? comparisonWindow.selectedEnd : naturalEnd
    const items = scopeFlowItems(itemsInRange(allItems, historyStart, historyEnd), scopeIds)
    return {
      label: monthName(date.getUTCFullYear(), date.getUTCMonth() + 1).slice(0, 3),
      month: date.getUTCMonth() + 1,
      year: date.getUTCFullYear(),
      totalSpent: round(spent(items)),
      estimatedConsumption: round(consumed(items)),
      partial: isSelectedMonth && comparisonWindow.isPartial,
    }
  })

  const directParentId = selected?.id ?? null
  const directCurrent = current.filter((item) => item.groupId === directParentId)
  const directBefore = before.filter((item) => item.groupId === directParentId)
  const directVariation = analyzeFlowVariation(directCurrent, directBefore)
  const directImpactById = new Map(directVariation.productImpacts.map((impact) => [impact.id, impact]))
  const productGroups = new Map<string, { name: string; amount: number; prices: number[]; unit: string; purchases: Set<string> }>()
  for (const item of directCurrent) {
    const group = productGroups.get(item.key) ?? {
      name: item.name,
      amount: 0,
      prices: [],
      unit: item.comparableUnit ?? item.unit ?? 'un',
      purchases: new Set<string>(),
    }
    group.amount += item.totalPrice
    if (item.comparableQuantity && item.comparableQuantity > 0) {
      group.prices.push(item.totalPrice / item.comparableQuantity)
    }
    if (item.purchaseId) group.purchases.add(item.purchaseId)
    productGroups.set(item.key, group)
  }

  const productIds = rows
    .filter((row) => row.produtoId && scopeIds.has(row.id))
    .flatMap((row) => row.produtoId ? [row.produtoId] : [])
  const inferenceEvents = await relevantAttentionEvents(
    productIds,
    userId,
    comparisonWindow.selectedStart,
    comparisonWindow.selectedEnd,
  )

  const attention = [
    ...variation.productImpacts
      .filter((impact) => impact.priceEffect > 0.009)
      .map((impact) => ({
        id: `price-${impact.id}`,
        type: 'price_increase',
        title: `${impact.name} ficou mais caro`,
        description: impact.unitComparable
          ? `O efeito de preço acrescentou ${round(impact.priceEffect).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} no período comparável.`
          : 'A unidade não permitiu uma comparação segura de preço.',
        amount: round(impact.priceEffect),
        confidence: null,
        productId: impact.id,
      })),
    ...variation.productImpacts
      .filter((impact) => impact.status === 'unit_incompatible')
      .map((impact) => ({
        id: `unit-${impact.id}`,
        type: 'unit_incompatible',
        title: `Confira a unidade de ${impact.name}`,
        description: 'Preço e quantidade não foram separados porque as unidades não são comparáveis com segurança.',
        amount: Math.abs(impact.variation),
        confidence: 'instavel',
        productId: impact.id,
      })),
    ...inferenceEvents.map((event) => ({
      id: event.id,
      type: event.type,
      title: event.title,
      description: `${event.product.standardName}: ${event.description}`,
      amount: null,
      confidence: event.confidence,
      productId: event.productId,
    })),
  ].sort((left, right) => Math.abs(right.amount ?? 0) - Math.abs(left.amount ?? 0)).slice(0, 8)

  const children = categories
    .filter((category) => category.parentId === directParentId && (category.totalSpent > 0 || category.previousTotalSpent > 0))
    .map((category) => ({
      ...category,
      shareOfTotal: ratio(category.totalSpent, flow.totalSpent),
      contributionToChange: variation.difference ? round(category.variation / variation.difference * 100) : 0,
    }))
    .sort((left, right) => right.totalSpent - left.totalSpent || left.name.localeCompare(right.name, 'pt-BR'))

  const previousMonthLabel = monthName(
    comparisonWindow.referenceStart.getUTCFullYear(),
    comparisonWindow.referenceStart.getUTCMonth() + 1,
  )

  return {
    year,
    month,
    monthLabel: monthName(year, month),
    previousMonthLabel,
    totalSpent: round(flow.totalSpent),
    previousTotalSpent: round(flow.previousTotalSpent),
    difference: variation.difference,
    estimatedConsumption: round(flow.estimatedConsumption),
    stockAmount: round(flow.stockAmount),
    recurringAmount: round(flow.recurringAmount),
    punctualAmount: round(flow.punctualAmount),
    priceIncreaseAmount: round(Math.max(0, variation.components.find((component) => component.type === 'price')?.amount ?? 0)),
    quantityIncreaseAmount: round(Math.max(0, variation.components.find((component) => component.type === 'quantity')?.amount ?? 0)),
    purchaseCount: new Set(current.flatMap((item) => item.purchaseId ? [item.purchaseId] : [])).size,
    comparison: {
      kind: comparisonWindow.comparisonKind,
      isPartial: comparisonWindow.isPartial,
      throughDay: comparisonWindow.throughDay,
      referenceThroughDay: comparisonWindow.referenceThroughDay,
      referenceYear: comparisonWindow.referenceStart.getUTCFullYear(),
      referenceMonth: comparisonWindow.referenceStart.getUTCMonth() + 1,
      label: comparisonWindow.isPartial
        ? `Até o dia ${comparisonWindow.throughDay} versus os mesmos dias de ${previousMonthLabel}`
        : `${monthName(year, month)} versus ${previousMonthLabel}`,
      differencePercentage: variation.differencePercentage,
    },
    variation: {
      components: variation.components,
      principalMessage: variation.principalMessage,
      reconciledTotal: round(variation.components.reduce((sum, component) => sum + component.amount, 0)),
    },
    productImpacts: variation.productImpacts,
    attention,
    categories,
    history,
    insights: variation.components
      .filter((component) => Math.abs(component.amount) > 0.009)
      .map((component) => ({
        id: `${selected?.id ?? 'all'}-${component.type}`,
        type: component.type,
        title: component.label,
        description: component.description,
        amount: component.amount,
      })),
    outOfPattern: outOfPattern.map((item) => ({
      name: item.name,
      amount: item.totalPrice,
      behaviorType: item.behaviorType,
    })),
    classification: {
      selected: selected ? categoryById.get(selected.id) ?? null : null,
      breadcrumbs: selected
        ? pathOf(selected, byId).map((row) => ({ id: row.id, name: row.nome, icon: row.icone, color: row.cor }))
        : [],
      children,
      directTotalSpent: round(spent(directCurrent)),
      directPreviousTotalSpent: round(spent(directBefore)),
      products: Array.from(productGroups.entries()).map(([id, group]) => {
        const impact = directImpactById.get(id)
        return {
          id,
          name: group.name,
          amount: round(group.amount),
          previousAmount: impact?.referenceAmount ?? 0,
          variation: impact?.variation ?? group.amount,
          variationPercentage: impact?.variationPercentage ?? null,
          purchaseCount: group.purchases.size,
          averageUnitPrice: round(group.prices.reduce((sum, price) => sum + price, 0) / Math.max(1, group.prices.length)),
          unit: group.unit,
        }
      }).sort((left, right) => right.amount - left.amount),
    },
  }
}
