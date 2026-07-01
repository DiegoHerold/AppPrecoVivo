import type { BehaviorType } from '@/generated/prisma/client'
import type { FlowItem } from '@/lib/domain'

const toCents = (value: number) => Math.round(value * 100)
const fromCents = (value: number) => value / 100
const round = (value: number, digits = 2) => Math.round(value * 10 ** digits) / 10 ** digits

export type FlowVariationComponentType = 'price' | 'quantity' | 'new_products' | 'removed_products' | 'mix'

export type FlowVariationComponent = {
  type: FlowVariationComponentType
  label: string
  description: string
  amount: number
}

export type ProductVariationStatus = 'new' | 'removed' | 'changed' | 'out_of_pattern' | 'unit_incompatible'

export type ProductVariationImpact = {
  id: string
  name: string
  behaviorType: BehaviorType
  status: ProductVariationStatus
  currentAmount: number
  referenceAmount: number
  variation: number
  variationPercentage: number | null
  priceEffect: number
  quantityEffect: number
  mixEffect: number
  currentUnitPrice: number | null
  referenceUnitPrice: number | null
  currentQuantity: number | null
  referenceQuantity: number | null
  unit: string | null
  unitComparable: boolean
}

export type FlowVariationAnalysis = {
  difference: number
  differencePercentage: number | null
  components: FlowVariationComponent[]
  productImpacts: ProductVariationImpact[]
  principalMessage: string
}

type ProductAggregate = {
  id: string
  name: string
  behaviorType: BehaviorType
  amountCents: number
  quantity: number
  unit: string | null
  comparable: boolean
}

const componentMeta: Record<FlowVariationComponentType, { label: string; description: string }> = {
  price: {
    label: 'Efeito de preço',
    description: 'Mudança do preço por unidade comparável, mantendo a quantidade atual.',
  },
  quantity: {
    label: 'Efeito de quantidade',
    description: 'Mudança da quantidade comprada, usando o preço do período de referência.',
  },
  new_products: {
    label: 'Produtos novos no período',
    description: 'Itens comprados agora que não apareceram no período de referência.',
  },
  removed_products: {
    label: 'Produtos que não se repetiram',
    description: 'Itens do período de referência que não foram comprados agora.',
  },
  mix: {
    label: 'Mudança de composição',
    description: 'Variações que não podem ser separadas com segurança por unidade.',
  },
}

function aggregateProducts(items: FlowItem[]): Map<string, ProductAggregate> {
  const grouped = new Map<string, ProductAggregate>()
  for (const item of items) {
    const unit = item.comparableUnit ?? null
    const quantity = item.comparableQuantity
    const existing = grouped.get(item.key) ?? {
      id: item.key,
      name: item.name,
      behaviorType: item.behaviorType,
      amountCents: 0,
      quantity: 0,
      unit,
      comparable: true,
    }
    existing.amountCents += toCents(item.totalPrice)
    existing.behaviorType = item.behaviorType
    existing.name = item.name
    if (quantity === null || quantity === undefined || quantity <= 0 || !unit) {
      existing.comparable = false
    } else if (existing.unit && existing.unit !== unit) {
      existing.comparable = false
    } else {
      existing.unit = unit
      existing.quantity += quantity
    }
    grouped.set(item.key, existing)
  }
  return grouped
}

function percent(current: number, reference: number): number | null {
  if (reference === 0) return null
  return round((current - reference) / reference * 100, 1)
}

function principalMessage(components: FlowVariationComponent[], difference: number) {
  if (Math.abs(difference) < 0.01) return 'O desembolso ficou praticamente estável no período comparável.'
  const principal = [...components].sort((left, right) => Math.abs(right.amount) - Math.abs(left.amount))[0]
  if (!principal || Math.abs(principal.amount) < 0.01) {
    return difference > 0 ? 'O desembolso aumentou, sem um fator isolado dominante.' : 'O desembolso caiu, sem um fator isolado dominante.'
  }
  const direction = principal.amount > 0 ? 'aumentou' : 'reduziu'
  return `O principal fator foi ${principal.label.toLocaleLowerCase('pt-BR')}, que ${direction} o desembolso em ${Math.abs(principal.amount).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}.`
}

/**
 * Decompõe a variação em efeitos mutuamente exclusivos. Para produtos com
 * unidade comparável, o efeito de quantidade usa o preço de referência e o
 * efeito de preço absorve a interação restante. Assim, cada produto e o total
 * sempre conciliam até o centavo.
 */
export function analyzeFlowVariation(current: FlowItem[], reference: FlowItem[]): FlowVariationAnalysis {
  const now = aggregateProducts(current)
  const before = aggregateProducts(reference)
  const keys = new Set([...now.keys(), ...before.keys()])
  const totals: Record<FlowVariationComponentType, number> = {
    price: 0,
    quantity: 0,
    new_products: 0,
    removed_products: 0,
    mix: 0,
  }
  const impacts: ProductVariationImpact[] = []

  for (const key of keys) {
    const currentProduct = now.get(key)
    const referenceProduct = before.get(key)
    const currentAmountCents = currentProduct?.amountCents ?? 0
    const referenceAmountCents = referenceProduct?.amountCents ?? 0
    const variationCents = currentAmountCents - referenceAmountCents
    let priceEffectCents = 0
    let quantityEffectCents = 0
    let mixEffectCents = 0
    let status: ProductVariationStatus = 'changed'
    let unitComparable = false

    if (!referenceProduct) {
      totals.new_products += currentAmountCents
      status = currentProduct?.behaviorType === 'fora_do_padrao' ? 'out_of_pattern' : 'new'
    } else if (!currentProduct) {
      totals.removed_products -= referenceAmountCents
      status = 'removed'
    } else if (
      currentProduct.comparable && referenceProduct.comparable &&
      currentProduct.unit === referenceProduct.unit &&
      currentProduct.quantity > 0 && referenceProduct.quantity > 0
    ) {
      unitComparable = true
      const referenceUnitPriceCents = referenceAmountCents / referenceProduct.quantity
      quantityEffectCents = Math.round((currentProduct.quantity - referenceProduct.quantity) * referenceUnitPriceCents)
      priceEffectCents = variationCents - quantityEffectCents
      totals.quantity += quantityEffectCents
      totals.price += priceEffectCents
      if (currentProduct.behaviorType === 'fora_do_padrao') status = 'out_of_pattern'
    } else {
      mixEffectCents = variationCents
      totals.mix += mixEffectCents
      status = 'unit_incompatible'
    }

    const product = currentProduct ?? referenceProduct!
    impacts.push({
      id: key,
      name: product.name,
      behaviorType: product.behaviorType,
      status,
      currentAmount: fromCents(currentAmountCents),
      referenceAmount: fromCents(referenceAmountCents),
      variation: fromCents(variationCents),
      variationPercentage: referenceAmountCents ? percent(currentAmountCents, referenceAmountCents) : null,
      priceEffect: fromCents(priceEffectCents),
      quantityEffect: fromCents(quantityEffectCents),
      mixEffect: fromCents(mixEffectCents),
      currentUnitPrice: currentProduct?.comparable && currentProduct.quantity > 0
        ? round(fromCents(currentAmountCents) / currentProduct.quantity)
        : null,
      referenceUnitPrice: referenceProduct?.comparable && referenceProduct.quantity > 0
        ? round(fromCents(referenceAmountCents) / referenceProduct.quantity)
        : null,
      currentQuantity: currentProduct?.comparable ? round(currentProduct.quantity, 3) : null,
      referenceQuantity: referenceProduct?.comparable ? round(referenceProduct.quantity, 3) : null,
      unit: unitComparable ? currentProduct?.unit ?? null : null,
      unitComparable,
    })
  }

  const currentTotalCents = [...now.values()].reduce((sum, item) => sum + item.amountCents, 0)
  const referenceTotalCents = [...before.values()].reduce((sum, item) => sum + item.amountCents, 0)
  const differenceCents = currentTotalCents - referenceTotalCents
  const components = (Object.keys(totals) as FlowVariationComponentType[]).map((type) => ({
    type,
    ...componentMeta[type],
    amount: fromCents(totals[type]),
  }))

  return {
    difference: fromCents(differenceCents),
    differencePercentage: referenceTotalCents ? percent(currentTotalCents, referenceTotalCents) : null,
    components,
    productImpacts: impacts.sort((left, right) => Math.abs(right.variation) - Math.abs(left.variation) || left.name.localeCompare(right.name, 'pt-BR')),
    principalMessage: principalMessage(components, fromCents(differenceCents)),
  }
}

export function scopeFlowItems(items: FlowItem[], nodeIds: Set<string>) {
  return items.filter((item) => Boolean(item.nodeId && nodeIds.has(item.nodeId)))
}

export function itemsInRange(items: FlowItem[], start: Date, end: Date) {
  return items.filter((item) => Boolean(item.purchaseDate && item.purchaseDate >= start && item.purchaseDate < end))
}

export function flowComparisonWindow(
  year: number,
  month: number,
  asOf: Date,
  reference?: { year: number; month: number },
) {
  const selectedStart = new Date(Date.UTC(year, month - 1, 1))
  const selectedNaturalEnd = new Date(Date.UTC(year, month, 1))
  const defaultReference = new Date(Date.UTC(year, month - 2, 1))
  const referenceStart = reference
    ? new Date(Date.UTC(reference.year, reference.month - 1, 1))
    : defaultReference
  const referenceNaturalEnd = new Date(Date.UTC(referenceStart.getUTCFullYear(), referenceStart.getUTCMonth() + 1, 1))
  const selectedIsCurrent = asOf.getUTCFullYear() === year && asOf.getUTCMonth() + 1 === month
  const referenceIsCurrent = asOf.getUTCFullYear() === referenceStart.getUTCFullYear() && asOf.getUTCMonth() === referenceStart.getUTCMonth()
  const compareThroughSameDay = selectedIsCurrent || referenceIsCurrent
  const selectedDays = new Date(Date.UTC(year, month, 0)).getUTCDate()
  const referenceDays = new Date(Date.UTC(referenceStart.getUTCFullYear(), referenceStart.getUTCMonth() + 1, 0)).getUTCDate()
  const throughDay = compareThroughSameDay ? Math.min(asOf.getUTCDate(), selectedDays, referenceDays) : selectedDays
  const referenceThroughDay = compareThroughSameDay ? throughDay : referenceDays

  return {
    selectedStart,
    selectedEnd: compareThroughSameDay ? new Date(Date.UTC(year, month - 1, throughDay + 1)) : selectedNaturalEnd,
    referenceStart,
    referenceEnd: compareThroughSameDay
      ? new Date(Date.UTC(referenceStart.getUTCFullYear(), referenceStart.getUTCMonth(), referenceThroughDay + 1))
      : referenceNaturalEnd,
    isPartial: compareThroughSameDay && (throughDay < selectedDays || referenceThroughDay < referenceDays),
    throughDay,
    referenceThroughDay,
    comparisonKind: compareThroughSameDay ? 'same_days_reference_month' as const : 'full_reference_month' as const,
  }
}
