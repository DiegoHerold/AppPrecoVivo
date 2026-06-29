/**
 * Engine de tendências e eventos de inferência.
 *
 * Classifica cada compra em um evento (compra normal, antecipada, tardia,
 * possível falta, grande volume, emergência...) e deriva eventos de tendência
 * de consumo. Tudo por regras estatísticas — sem IA, sem hardcode de produto.
 *
 * Princípios:
 * - Uma compra antecipada NÃO deve alterar drasticamente o consumo médio.
 * - Uma compra de grande volume aumenta o estoque, mas NÃO conclui sozinha que
 *   o consumo subiu.
 * - Um período sem produto NÃO é tratado como consumo normal.
 */

import type { ConsumptionMetrics, InferenceEvent } from '../../domain/entities'
import type { ConfidenceLevel, InferenceEventType } from '../../domain/types'
import { daysBetween } from '../../domain/value-objects/dates'

export interface PurchasePoint {
  id: string
  date: Date
  quantity: number
}

export interface EventDetectionParams {
  productId: string
  purchases: PurchasePoint[]
  consumption: ConsumptionMetrics
  confidence: ConfidenceLevel
  /** Estoque estimado IMEDIATAMENTE ANTES de cada compra é reconstruído aqui. */
  dailyConsumption: number | null
}

/** Fração do intervalo médio abaixo da qual a compra é "antecipada". */
const EARLY_RATIO = 0.6
/** Fração acima da qual a compra é "tardia". */
const LATE_RATIO = 1.5
/** Múltiplo da mediana de quantidade acima do qual é "grande volume". */
const BULK_MEDIAN_MULTIPLE = 2.5
/** Dias de estoque negativo a partir dos quais marcamos possível falta. */
const SHORTAGE_MIN_DAYS = 1

function buildEvent(
  type: InferenceEventType,
  params: { productId: string; purchaseId: string | null; date: Date; message: string; confidence: ConfidenceLevel; details?: Record<string, number | string | null> },
): InferenceEvent {
  return {
    type,
    productId: params.productId,
    purchaseId: params.purchaseId,
    date: params.date,
    message: params.message,
    confidence: params.confidence,
    details: params.details ?? {},
  }
}

/**
 * Classifica eventos por compra. Caminha cronologicamente e, a cada compra
 * (a partir da segunda), avalia:
 * - intervalo desde a compra anterior vs. intervalo médio (antecipada/tardia);
 * - estoque reconstruído logo antes da compra (possível falta);
 * - quantidade vs. mediana histórica (grande volume).
 */
export function detectPurchaseEvents(
  params: EventDetectionParams,
): InferenceEvent[] {
  const { productId, consumption, confidence } = params
  const sorted = [...params.purchases].sort(
    (a, b) => a.date.getTime() - b.date.getTime(),
  )
  if (sorted.length < 2) {
    return sorted.map((p) =>
      buildEvent('compra_normal', {
        productId,
        purchaseId: p.id,
        date: p.date,
        message: 'Primeira compra registrada deste produto.',
        confidence: 'muito_baixa',
      }),
    )
  }

  const avgInterval = consumption.averagePurchaseInterval
  const medianQty = consumption.quantityStats.median
  const consumptionRate = params.dailyConsumption ?? 0
  const events: InferenceEvent[] = []

  // Estoque reconstruído incrementalmente para detectar falta antes de cada compra.
  let stock = 0
  let cursor = sorted[0].date
  stock += sorted[0].quantity
  events.push(
    buildEvent('compra_normal', {
      productId,
      purchaseId: sorted[0].id,
      date: sorted[0].date,
      message: 'Primeira compra registrada deste produto.',
      confidence,
    }),
  )

  for (let i = 1; i < sorted.length; i += 1) {
    const prev = sorted[i - 1]
    const current = sorted[i]
    const interval = daysBetween(current.date, prev.date)

    // Estoque imediatamente antes desta compra.
    const elapsed = daysBetween(current.date, cursor)
    const stockBefore = stock - consumptionRate * elapsed

    let classified = false

    // 1) Possível período sem produto: estoque estimado esgotou antes da recompra.
    if (consumptionRate > 0 && stockBefore < 0) {
      const shortageDays = Math.abs(stockBefore) / consumptionRate
      if (shortageDays >= SHORTAGE_MIN_DAYS) {
        events.push(
          buildEvent('possivel_periodo_sem_produto', {
            productId,
            purchaseId: current.id,
            date: current.date,
            message: `Possível falta de produto por cerca de ${Math.round(shortageDays)} dia(s) antes desta compra.`,
            confidence,
            details: { shortageDays: Math.round(shortageDays) },
          }),
        )
        classified = true
      }
    }

    // 2) Compra antecipada: comprou bem antes do intervalo médio (ainda havia estoque).
    if (
      !classified &&
      avgInterval !== null &&
      avgInterval > 0 &&
      interval < avgInterval * EARLY_RATIO &&
      stockBefore > 0
    ) {
      events.push(
        buildEvent('compra_antecipada', {
          productId,
          purchaseId: current.id,
          date: current.date,
          message: `Compra antecipada: ${Math.round(interval)} dias após a anterior (média ~${Math.round(avgInterval)} dias).`,
          confidence,
          details: { intervalDays: Math.round(interval), averageIntervalDays: Math.round(avgInterval) },
        }),
      )
      classified = true
    }

    // 3) Compra tardia: intervalo muito acima da média.
    if (
      !classified &&
      avgInterval !== null &&
      avgInterval > 0 &&
      interval > avgInterval * LATE_RATIO
    ) {
      events.push(
        buildEvent('compra_tardia', {
          productId,
          purchaseId: current.id,
          date: current.date,
          message: `Compra tardia: ${Math.round(interval)} dias após a anterior (média ~${Math.round(avgInterval)} dias).`,
          confidence,
          details: { intervalDays: Math.round(interval), averageIntervalDays: Math.round(avgInterval) },
        }),
      )
      classified = true
    }

    // 4) Grande volume: quantidade muito acima da mediana histórica.
    //    Independente da classificação temporal — pode coexistir.
    if (
      medianQty !== null &&
      medianQty > 0 &&
      current.quantity >= medianQty * BULK_MEDIAN_MULTIPLE
    ) {
      events.push(
        buildEvent('compra_grande_volume', {
          productId,
          purchaseId: current.id,
          date: current.date,
          message: `Compra em grande volume: ${current.quantity} (mediana ~${medianQty}).`,
          confidence,
          details: { quantity: current.quantity, medianQuantity: medianQty },
        }),
      )
      classified = true
    }

    if (!classified) {
      events.push(
        buildEvent('compra_normal', {
          productId,
          purchaseId: current.id,
          date: current.date,
          message: 'Compra dentro do padrão histórico.',
          confidence,
        }),
      )
    }

    // Atualiza estoque: aplica consumo do período e soma a compra.
    stock = stockBefore + current.quantity
    cursor = current.date
  }

  return events
}

/**
 * Deriva eventos de tendência de consumo (aumentando/diminuindo) a partir das
 * métricas já calculadas. Não reavalia compras individuais.
 */
export function detectTrendEvents(
  productId: string,
  consumption: ConsumptionMetrics,
  confidence: ConfidenceLevel,
  referenceDate: Date,
): InferenceEvent[] {
  if (consumption.trend === 'aumentando') {
    return [
      buildEvent('consumo_aumentando', {
        productId,
        purchaseId: null,
        date: referenceDate,
        message: 'Consumo aparenta estar aumentando ao longo do tempo.',
        confidence,
      }),
    ]
  }
  if (consumption.trend === 'diminuindo') {
    return [
      buildEvent('consumo_diminuindo', {
        productId,
        purchaseId: null,
        date: referenceDate,
        message: 'Consumo aparenta estar diminuindo ao longo do tempo.',
        confidence,
      }),
    ]
  }
  return []
}
