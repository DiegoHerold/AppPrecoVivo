/**
 * Composição do motor de inferência.
 *
 * `inferProduct` é uma função PURA: dados os registros de compra de um produto
 * e uma data de referência, devolve a `ProductInference` completa (consumo,
 * estoque, confiança, eventos). Não toca em banco nem em relógio global — a
 * data "agora" é injetada, o que torna o motor 100% testável.
 *
 * Esta é a única camada que o serviço precisa chamar por produto.
 */

import type {
  InferenceEvent,
  ProductInference,
  ProductInput,
  PurchaseRecord,
} from '../domain/entities'
import { classifyConfidence } from './confidence'
import { computeConsumption } from './consumption'
import { computeInventory } from './inventory'
import { mean } from './statistics'
import { detectPurchaseEvents, detectTrendEvents } from './trends'

export interface InferProductParams {
  product: ProductInput
  purchases: PurchaseRecord[]
  asOf: Date
}

export function inferProduct(params: InferProductParams): ProductInference {
  const { product, purchases, asOf } = params
  const sorted = [...purchases].sort(
    (a, b) => a.date.getTime() - b.date.getTime(),
  )
  // Quantidades incompatíveis continuam no histórico e nos preços, mas não
  // podem ser somadas fisicamente como se fossem da unidade padrão.
  const usable = sorted.filter((purchase) => purchase.unitConverted)

  const consumption = computeConsumption(
    usable.map((p) => ({ date: p.date, quantity: p.quantity })),
  )

  const confidence = classifyConfidence({
    purchaseCount: usable.length,
    intervalCoefficientOfVariation:
      consumption.intervalStats.coefficientOfVariation,
    compatiblePurchaseRatio: sorted.length ? usable.length / sorted.length : 1,
  })

  const inventory = computeInventory({
    purchases: usable.map((p) => ({ date: p.date, quantity: p.quantity })),
    dailyConsumption: consumption.dailyAverage,
    unit: product.standardUnit,
    asOf,
  })

  const purchaseEvents = detectPurchaseEvents({
    productId: product.id,
    purchases: usable.map((p) => ({ id: p.id, date: p.date, quantity: p.quantity })),
    consumption,
    confidence,
    dailyConsumption: consumption.dailyAverage,
    behaviorType: product.behaviorType,
  })

  const trendEvents = detectTrendEvents(product.id, consumption, confidence, asOf)

  const events: InferenceEvent[] = [...purchaseEvents, ...trendEvents].sort(
    (a, b) => b.date.getTime() - a.date.getTime(),
  )

  const prices = sorted.map((p) => p.unitPrice).filter((value) => value > 0)
  // refillCount: ciclos de reposição = compras - 1 (nunca a mesma coisa que
  // o número de compras nem que consumo).
  const refillCount = Math.max(0, usable.length - 1)

  return {
    productId: product.id,
    name: product.name,
    category: product.category,
    unit: product.standardUnit,
    consumption,
    inventory,
    confidence,
    purchaseCount: sorted.length,
    usablePurchaseCount: usable.length,
    refillCount,
    lastPurchaseDate: sorted.length ? sorted[sorted.length - 1].date : null,
    averagePrice: prices.length ? mean(prices) : null,
    minPrice: prices.length ? Math.min(...prices) : null,
    maxPrice: prices.length ? Math.max(...prices) : null,
    events,
  }
}
