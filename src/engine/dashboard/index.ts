/** Agregações puras do dashboard. Nenhum cálculo de negócio fica no React. */

import type { ProductInference, PurchaseRecord } from '../../domain/entities'
import type { ConfidenceLevel, StockStatus } from '../../domain/types'
import { monthKey, MS_PER_DAY } from '../../domain/value-objects/dates'

export const NEAR_END_DAYS = 7
export const RECENT_REFILL_DAYS = 7
export const STALE_PURCHASE_DAYS = 90

export interface DashboardProductSummary {
  productId: string
  name: string
  category: string | null
  status: StockStatus
  daysRemaining: number | null
  confidence: ConfidenceLevel
}

export interface DashboardSnapshot {
  productsWithStockEstimate: number
  nearEnd: DashboardProductSummary[]
  recentlyRefilled: DashboardProductSummary[]
  staleProducts: DashboardProductSummary[]
  earlyPurchases: DashboardProductSummary[]
  possibleShortages: DashboardProductSummary[]
  topConsumingCategories: {
    category: string
    estimatedMonthlyCost: number
    productCount: number
  }[]
  currentMonth: {
    totalSpent: number
    productsPurchased: number
    purchaseCount: number
  }
  topStores: { store: string; purchaseCount: number }[]
}

const round = (value: number, digits = 2) =>
  Math.round(value * 10 ** digits) / 10 ** digits

function summary(inference: ProductInference): DashboardProductSummary {
  return {
    productId: inference.productId,
    name: inference.name,
    category: inference.category,
    status: inference.inventory.status,
    daysRemaining:
      inference.inventory.daysRemaining === null
        ? null
        : Math.round(inference.inventory.daysRemaining),
    confidence: inference.confidence,
  }
}

export function estimatedMonthlyCost(inference: ProductInference): number | null {
  if (
    inference.consumption.monthlyAverage === null ||
    inference.averagePrice === null
  ) return null
  return inference.consumption.monthlyAverage * inference.averagePrice
}

export function aggregateDashboardSnapshot(params: {
  inferences: ProductInference[]
  purchases: PurchaseRecord[]
  asOf: Date
}): DashboardSnapshot {
  const { inferences, purchases, asOf } = params
  const nearEnd: DashboardProductSummary[] = []
  const recentlyRefilled: DashboardProductSummary[] = []
  const staleProducts: DashboardProductSummary[] = []
  const earlyPurchases: DashboardProductSummary[] = []
  const possibleShortages: DashboardProductSummary[] = []
  const categories = new Map<string, { cost: number; products: Set<string> }>()
  let productsWithStockEstimate = 0

  for (const inference of inferences) {
    const item = summary(inference)
    if (inference.inventory.status !== 'sem_dados') productsWithStockEstimate += 1
    if (
      inference.inventory.status === 'proximo_do_fim' ||
      (inference.inventory.daysRemaining !== null &&
        inference.inventory.daysRemaining <= NEAR_END_DAYS &&
        inference.inventory.estimatedStock > 0)
    ) nearEnd.push(item)
    if (
      inference.lastPurchaseDate &&
      (asOf.getTime() - inference.lastPurchaseDate.getTime()) / MS_PER_DAY <=
        RECENT_REFILL_DAYS
    ) recentlyRefilled.push(item)
    if (inference.inventory.status === 'possivel_falta') possibleShortages.push(item)
    if (
      inference.lastPurchaseDate &&
      (asOf.getTime() - inference.lastPurchaseDate.getTime()) / MS_PER_DAY >
        STALE_PURCHASE_DAYS
    ) staleProducts.push(item)
    if (
      inference.lastPurchaseDate &&
      inference.events.some(
        (event) =>
          event.type === 'compra_antecipada' &&
          event.date.getTime() === inference.lastPurchaseDate!.getTime(),
      )
    ) earlyPurchases.push(item)

    const cost = estimatedMonthlyCost(inference)
    if (inference.category && cost !== null) {
      const current = categories.get(inference.category) ?? {
        cost: 0,
        products: new Set<string>(),
      }
      current.cost += cost
      current.products.add(inference.productId)
      categories.set(inference.category, current)
    }
  }

  const currentKey = monthKey(asOf)
  let totalSpent = 0
  const currentProducts = new Set<string>()
  const currentPurchases = new Set<string>()
  const uniquePurchases = new Map<string, PurchaseRecord>()

  for (const purchase of purchases) {
    if (!uniquePurchases.has(purchase.purchaseId)) {
      uniquePurchases.set(purchase.purchaseId, purchase)
    }
    if (monthKey(purchase.date) === currentKey) {
      totalSpent += purchase.totalPrice
      currentProducts.add(purchase.productId)
      currentPurchases.add(purchase.purchaseId)
    }
  }

  const storeCount = new Map<string, number>()
  for (const purchase of uniquePurchases.values()) {
    if (!purchase.storeName) continue
    storeCount.set(
      purchase.storeName,
      (storeCount.get(purchase.storeName) ?? 0) + 1,
    )
  }

  return {
    productsWithStockEstimate,
    nearEnd: nearEnd.sort(
      (a, b) => (a.daysRemaining ?? Number.MAX_SAFE_INTEGER) -
        (b.daysRemaining ?? Number.MAX_SAFE_INTEGER),
    ),
    recentlyRefilled,
    staleProducts,
    earlyPurchases,
    possibleShortages,
    topConsumingCategories: [...categories.entries()]
      .sort((a, b) => b[1].cost - a[1].cost)
      .slice(0, 10)
      .map(([category, value]) => ({
        category,
        estimatedMonthlyCost: round(value.cost),
        productCount: value.products.size,
      })),
    currentMonth: {
      totalSpent: round(totalSpent),
      productsPurchased: currentProducts.size,
      purchaseCount: currentPurchases.size,
    },
    topStores: [...storeCount.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([store, purchaseCount]) => ({ store, purchaseCount })),
  }
}
