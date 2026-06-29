/**
 * Orquestra persistência real -> engine pura -> DTOs de apresentação.
 * A camada React recebe todos os indicadores já calculados.
 */

import 'server-only'

import type { ProductInference, ProductInput, PurchaseRecord } from '../domain/entities'
import type { ConfidenceLevel, StockStatus, TrendDirection } from '../domain/types'
import { inferProduct } from '../engine'
import {
  aggregateDashboardSnapshot,
  estimatedMonthlyCost,
  type DashboardProductSummary,
} from '../engine/dashboard'
import { confidenceLabel, formatEstimate } from '../engine/confidence'
import { monthKey } from '../domain/value-objects/dates'
import { loadProductInput, loadProductInputs } from '../repositories/products.repository'
import { loadPurchasesByProduct, loadPurchasesForProduct } from '../repositories/purchases.repository'

const round = (value: number | null, digits = 2): number | null =>
  value === null ? null : Math.round(value * 10 ** digits) / 10 ** digits

export interface ProductDashboardEvent {
  type: string
  title: string
  description: string
  impact: string
  date: string
  confidence: ConfidenceLevel
  details: Record<string, number | string | null>
}

export interface ProductDashboard {
  productId: string
  name: string
  category: string | null
  unit: string
  estimatedStock: number
  estimatedStockLabel: string
  daysRemaining: number | null
  projectedDepletionDate: string | null
  dailyConsumption: number | null
  monthlyConsumption: number | null
  estimatedMonthlyCost: number | null
  lastPurchaseDate: string | null
  averagePrice: number | null
  minPrice: number | null
  maxPrice: number | null
  quantityPurchasedLastYear: number
  purchaseCount: number
  usablePurchaseCount: number
  refillCount: number
  averagePurchaseIntervalDays: number | null
  purchaseFrequencyPerMonth: number | null
  trend: TrendDirection
  status: StockStatus
  confidence: ConfidenceLevel
  confidenceLabel: string
  recentEvents: ProductDashboardEvent[]
}

export type ProductSummary = DashboardProductSummary

export interface GeneralDashboard {
  generatedAt: string
  productsWithStockEstimate: number
  nearEnd: ProductSummary[]
  recentlyRefilled: ProductSummary[]
  staleProducts: ProductSummary[]
  earlyPurchases: ProductSummary[]
  possibleShortages: ProductSummary[]
  topConsumingCategories: {
    category: string
    estimatedMonthlyCost: number
    productCount: number
  }[]
  consumptionByMonth: { month: string; label: string; total: number }[]
  spendByMonth: { month: string; label: string; total: number }[]
  currentMonth: {
    totalSpent: number
    productsPurchased: number
    purchaseCount: number
  }
  topStores: { store: string; purchaseCount: number }[]
}

function toProductDashboard(
  inference: ProductInference,
  purchasesLastYear: number,
): ProductDashboard {
  return {
    productId: inference.productId,
    name: inference.name,
    category: inference.category,
    unit: inference.unit,
    estimatedStock: round(inference.inventory.estimatedStock)!,
    estimatedStockLabel: formatEstimate(inference.inventory.estimatedStock, inference.unit),
    daysRemaining:
      inference.inventory.daysRemaining === null
        ? null
        : Math.max(0, Math.round(inference.inventory.daysRemaining)),
    projectedDepletionDate:
      inference.inventory.projectedDepletionDate?.toISOString() ?? null,
    dailyConsumption: round(inference.consumption.dailyAverage, 3),
    monthlyConsumption: round(inference.consumption.monthlyAverage, 2),
    estimatedMonthlyCost: round(estimatedMonthlyCost(inference)),
    lastPurchaseDate: inference.lastPurchaseDate?.toISOString() ?? null,
    averagePrice: round(inference.averagePrice),
    minPrice: round(inference.minPrice),
    maxPrice: round(inference.maxPrice),
    quantityPurchasedLastYear: round(purchasesLastYear)!,
    purchaseCount: inference.purchaseCount,
    usablePurchaseCount: inference.usablePurchaseCount,
    refillCount: inference.refillCount,
    averagePurchaseIntervalDays:
      inference.consumption.averageRefillInterval === null
        ? null
        : Math.round(inference.consumption.averageRefillInterval),
    purchaseFrequencyPerMonth: round(inference.consumption.purchaseFrequencyPerMonth),
    trend: inference.consumption.trend,
    status: inference.inventory.status,
    confidence: inference.confidence,
    confidenceLabel: confidenceLabel(inference.confidence),
    recentEvents: inference.events.slice(0, 12).map((event) => ({
      type: event.type,
      title: event.title,
      description: event.description,
      impact: event.impact,
      date: event.date.toISOString(),
      confidence: event.confidence,
      details: event.details,
    })),
  }
}

export async function buildProductDashboard(
  userId: string,
  productId: string,
  asOf: Date = new Date(),
): Promise<ProductDashboard | null> {
  const product = await loadProductInput(userId, productId)
  if (!product) return null
  const purchases = await loadPurchasesForProduct(userId, productId)
  const inference = inferProduct({ product, purchases, asOf })

  const oneYearAgo = new Date(asOf)
  oneYearAgo.setUTCFullYear(oneYearAgo.getUTCFullYear() - 1)
  const lastYearQty = purchases
    .filter((purchase) => purchase.unitConverted && purchase.date >= oneYearAgo)
    .reduce((sum, purchase) => sum + purchase.quantity, 0)

  return toProductDashboard(inference, lastYearQty)
}

function monthWindows(asOf: Date, count = 6) {
  const windows: { month: string; label: string; start: Date; end: Date }[] = []
  for (let offset = count - 1; offset >= 0; offset -= 1) {
    const start = new Date(Date.UTC(asOf.getUTCFullYear(), asOf.getUTCMonth() - offset, 1))
    const naturalEnd = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 1) - 1)
    const end = naturalEnd.getTime() > asOf.getTime() ? asOf : naturalEnd
    windows.push({
      month: monthKey(start),
      label: new Intl.DateTimeFormat('pt-BR', {
        month: 'short',
        timeZone: 'UTC',
      }).format(start).replace('.', ''),
      start,
      end,
    })
  }
  return windows
}

function historySeries(params: {
  products: ProductInput[]
  purchasesByProduct: Map<string, PurchaseRecord[]>
  asOf: Date
}) {
  const windows = monthWindows(params.asOf)
  const allPurchases = [...params.purchasesByProduct.values()].flat()
  const spendByMonth = windows.map((window) => ({
    month: window.month,
    label: window.label,
    total: round(
      allPurchases
        .filter((purchase) => monthKey(purchase.date) === window.month)
        .reduce((sum, purchase) => sum + purchase.totalPrice, 0),
    )!,
  }))

  const consumptionByMonth = windows.map((window) => {
    let total = 0
    for (const product of params.products) {
      const purchases = (params.purchasesByProduct.get(product.id) ?? []).filter(
        (purchase) => purchase.date <= window.end,
      )
      const inference = inferProduct({ product, purchases, asOf: window.end })
      total += estimatedMonthlyCost(inference) ?? 0
    }
    return { month: window.month, label: window.label, total: round(total)! }
  })

  return { spendByMonth, consumptionByMonth }
}

export async function buildGeneralDashboard(
  userId: string,
  asOf: Date = new Date(),
): Promise<GeneralDashboard> {
  const [products, purchasesByProduct] = await Promise.all([
    loadProductInputs(userId),
    loadPurchasesByProduct(userId),
  ])
  const inferences = products.map((product) =>
    inferProduct({
      product,
      purchases: purchasesByProduct.get(product.id) ?? [],
      asOf,
    }),
  )
  const allPurchases = [...purchasesByProduct.values()].flat()
  const snapshot = aggregateDashboardSnapshot({ inferences, purchases: allPurchases, asOf })
  const history = historySeries({ products, purchasesByProduct, asOf })

  return {
    generatedAt: asOf.toISOString(),
    ...snapshot,
    ...history,
  }
}
