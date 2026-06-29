/**
 * Serviço de relatórios do motor de inferência.
 *
 * Orquestra: repositories (dados reais) -> engine (cálculo puro) -> DTOs
 * prontos para a interface. A interface NÃO recalcula nada: recebe estoque
 * estimado, dias restantes, confiança, eventos e agregados já formatados.
 *
 * Toda a data "agora" é injetável para manter determinismo e testabilidade.
 */

import 'server-only'

import type { ProductInference } from '../domain/entities'
import type {
  ConfidenceLevel,
  StockStatus,
  TrendDirection,
} from '../domain/types'
import { inferProduct } from '../engine'
import { confidenceLabel, formatEstimate } from '../engine/confidence'
import { monthKey } from '../domain/value-objects/dates'
import { loadProductInput, loadProductInputs } from '../repositories/products.repository'
import {
  loadPurchasesByProduct,
  loadPurchasesForProduct,
} from '../repositories/purchases.repository'

const round = (value: number | null, digits = 2): number | null =>
  value === null ? null : Math.round(value * 10 ** digits) / 10 ** digits

/** Limiar (em dias restantes) para "próximo do fim" nos agregados. */
const NEAR_END_DAYS = 7
/** Dias sem compra para considerar um produto "parado". */
const STALE_PURCHASE_DAYS = 90

// ---------------------------------------------------------------------------
// DTOs de saída
// ---------------------------------------------------------------------------

export interface ProductDashboardEvent {
  type: string
  date: string
  message: string
  confidence: ConfidenceLevel
}

export interface ProductDashboard {
  productId: string
  name: string
  category: string | null
  unit: string
  estimatedStock: number
  estimatedStockLabel: string
  daysRemaining: number | null
  dailyConsumption: number | null
  monthlyConsumption: number | null
  lastPurchaseDate: string | null
  averagePrice: number | null
  minPrice: number | null
  maxPrice: number | null
  quantityPurchasedLastYear: number
  purchaseCount: number
  refillCount: number
  averagePurchaseIntervalDays: number | null
  purchaseFrequencyPerMonth: number | null
  trend: TrendDirection
  status: StockStatus
  confidence: ConfidenceLevel
  confidenceLabel: string
  recentEvents: ProductDashboardEvent[]
}

export interface GeneralDashboard {
  generatedAt: string
  totalEstimatedStockItems: number
  nearEnd: ProductSummary[]
  recentlyRefilled: ProductSummary[]
  staleProducts: ProductSummary[]
  earlyPurchases: ProductSummary[]
  possibleShortages: ProductSummary[]
  topConsumingCategories: { category: string; monthlyConsumption: number }[]
  consumptionByMonth: { month: string; total: number }[]
  spendByMonth: { month: string; total: number }[]
  currentMonth: {
    totalSpent: number
    productsPurchased: number
    purchaseCount: number
  }
  topStores: { store: string; purchaseCount: number }[]
}

export interface ProductSummary {
  productId: string
  name: string
  category: string | null
  status: StockStatus
  daysRemaining: number | null
  confidence: ConfidenceLevel
}

// ---------------------------------------------------------------------------
// Mapeamento engine -> DTO
// ---------------------------------------------------------------------------

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
    estimatedStockLabel: formatEstimate(
      inference.inventory.estimatedStock,
      inference.unit,
    ),
    daysRemaining:
      inference.inventory.daysRemaining === null
        ? null
        : Math.round(inference.inventory.daysRemaining),
    dailyConsumption: round(inference.consumption.dailyAverage, 3),
    monthlyConsumption: round(inference.consumption.monthlyAverage, 2),
    lastPurchaseDate: inference.lastPurchaseDate?.toISOString() ?? null,
    averagePrice: round(inference.averagePrice),
    minPrice: round(inference.minPrice),
    maxPrice: round(inference.maxPrice),
    quantityPurchasedLastYear: round(purchasesLastYear)!,
    purchaseCount: inference.purchaseCount,
    refillCount: inference.refillCount,
    averagePurchaseIntervalDays:
      inference.consumption.averagePurchaseInterval === null
        ? null
        : Math.round(inference.consumption.averagePurchaseInterval),
    purchaseFrequencyPerMonth: round(
      inference.consumption.purchaseFrequencyPerMonth,
    ),
    trend: inference.consumption.trend,
    status: inference.inventory.status,
    confidence: inference.confidence,
    confidenceLabel: confidenceLabel(inference.confidence),
    recentEvents: inference.events.slice(0, 8).map((event) => ({
      type: event.type,
      date: event.date.toISOString(),
      message: event.message,
      confidence: event.confidence,
    })),
  }
}

function toSummary(inference: ProductInference): ProductSummary {
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

// ---------------------------------------------------------------------------
// API pública do serviço
// ---------------------------------------------------------------------------

export async function buildProductDashboard(
  userId: string,
  productId: string,
  asOf: Date = new Date(),
): Promise<ProductDashboard | null> {
  const product = await loadProductInput(userId, productId)
  if (!product) return null
  const purchases = await loadPurchasesForProduct(userId, productId)
  const inference = inferProduct({ product, purchases, asOf })

  const oneYearAgo = new Date(asOf.getTime())
  oneYearAgo.setUTCFullYear(oneYearAgo.getUTCFullYear() - 1)
  const lastYearQty = purchases
    .filter((p) => p.date >= oneYearAgo)
    .reduce((sum, p) => sum + p.quantity, 0)

  return toProductDashboard(inference, lastYearQty)
}

export async function buildGeneralDashboard(
  userId: string,
  asOf: Date = new Date(),
): Promise<GeneralDashboard> {
  const [products, purchasesByProduct] = await Promise.all([
    loadProductInputs(userId),
    loadPurchasesByProduct(userId),
  ])

  const inferences: ProductInference[] = products.map((product) =>
    inferProduct({
      product,
      purchases: purchasesByProduct.get(product.id) ?? [],
      asOf,
    }),
  )

  const nearEnd: ProductSummary[] = []
  const recentlyRefilled: ProductSummary[] = []
  const staleProducts: ProductSummary[] = []
  const earlyPurchases: ProductSummary[] = []
  const possibleShortages: ProductSummary[] = []
  const categoryConsumption = new Map<string, number>()
  let totalEstimatedStockItems = 0

  for (const inference of inferences) {
    totalEstimatedStockItems += inference.inventory.estimatedStock

    const summary = toSummary(inference)
    const days = inference.inventory.daysRemaining

    if (inference.inventory.status === 'proximo_do_fim' || (days !== null && days <= NEAR_END_DAYS)) {
      nearEnd.push(summary)
    }
    if (inference.inventory.status === 'recem_abastecido') {
      recentlyRefilled.push(summary)
    }
    if (inference.inventory.status === 'possivel_falta') {
      possibleShortages.push(summary)
    }
    if (
      inference.lastPurchaseDate &&
      (asOf.getTime() - inference.lastPurchaseDate.getTime()) / 86_400_000 >
        STALE_PURCHASE_DAYS
    ) {
      staleProducts.push(summary)
    }
    if (
      inference.events.some(
        (event) =>
          event.type === 'compra_antecipada' &&
          inference.lastPurchaseDate &&
          event.date.getTime() === inference.lastPurchaseDate.getTime(),
      )
    ) {
      earlyPurchases.push(summary)
    }

    if (inference.category && inference.consumption.monthlyAverage) {
      categoryConsumption.set(
        inference.category,
        (categoryConsumption.get(inference.category) ?? 0) +
          inference.consumption.monthlyAverage,
      )
    }
  }

  // Séries temporais e agregados do mês corrente a partir das compras reais.
  const allPurchases = [...purchasesByProduct.values()].flat()
  const consumptionMonth = new Map<string, number>()
  const spendMonth = new Map<string, number>()
  const storeCount = new Map<string, number>()
  const currentKey = monthKey(asOf)
  let currentSpent = 0
  const currentProducts = new Set<string>()
  const currentPurchases = new Set<string>()

  for (const purchase of allPurchases) {
    const key = monthKey(purchase.date)
    spendMonth.set(key, (spendMonth.get(key) ?? 0) + purchase.totalPrice)
    consumptionMonth.set(key, (consumptionMonth.get(key) ?? 0) + purchase.quantity)
    if (purchase.storeName) {
      storeCount.set(purchase.storeName, (storeCount.get(purchase.storeName) ?? 0) + 1)
    }
    if (key === currentKey) {
      currentSpent += purchase.totalPrice
      currentProducts.add(purchase.productId)
      currentPurchases.add(purchase.id)
    }
  }

  const sortByMonth = (map: Map<string, number>) =>
    [...map.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([month, total]) => ({ month, total: round(total)! }))

  return {
    generatedAt: asOf.toISOString(),
    totalEstimatedStockItems: round(totalEstimatedStockItems)!,
    nearEnd: nearEnd.sort((a, b) => (a.daysRemaining ?? 1e9) - (b.daysRemaining ?? 1e9)),
    recentlyRefilled,
    staleProducts,
    earlyPurchases,
    possibleShortages,
    topConsumingCategories: [...categoryConsumption.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([category, monthlyConsumption]) => ({
        category,
        monthlyConsumption: round(monthlyConsumption)!,
      })),
    consumptionByMonth: sortByMonth(consumptionMonth),
    spendByMonth: sortByMonth(spendMonth),
    currentMonth: {
      totalSpent: round(currentSpent)!,
      productsPurchased: currentProducts.size,
      purchaseCount: currentPurchases.size,
    },
    topStores: [...storeCount.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([store, purchaseCount]) => ({ store, purchaseCount })),
  }
}
