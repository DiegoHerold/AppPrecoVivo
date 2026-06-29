/**
 * Engine de consumo — estima QUANTO se consome por dia/mês a partir do
 * histórico de reposições. É recalculado sempre que novas compras entram.
 *
 * Premissa central e honesta: a próxima compra NÃO marca o dia exato em que o
 * produto acabou. Por isso o consumo é estimado pela quantidade reposta ao
 * longo do tempo decorrido, e não por "estoque zerou na data da recompra".
 *
 * Modelo: cada intervalo produz uma taxa observada (quantidade anterior / dias
 * até a próxima compra). A taxa final é uma média robusta dessas observações:
 * mediana como centro e descarte de extremos. Isso evita que uma compra
 * antecipada ou uma única compra volumosa altere drasticamente a previsão.
 */

import type { ConsumptionMetrics } from '../../domain/entities'
import type { TrendDirection } from '../../domain/types'
import { daysBetween } from '../../domain/value-objects/dates'
import {
  describe,
  intervalsInDays,
  linearTrendSlope,
  mean,
  median,
  purchasesPerMonth,
  seasonalityByMonth,
} from '../statistics'

const DAYS_PER_MONTH = 30.44

export interface ConsumptionSample {
  date: Date
  /** Quantidade reposta nessa compra, na unidade padrão do produto. */
  quantity: number
}

/** Limiar de inclinação relativa para considerar tendência (não-ruído). */
const TREND_RELATIVE_THRESHOLD = 0.05

/** Remove extremos grosseiros sem pressupor uma categoria ou produto. */
export function robustValues(values: number[]): number[] {
  const positive = values.filter((value) => Number.isFinite(value) && value > 0)
  if (positive.length < 3) return positive
  const center = median(positive)
  if (center === null || center <= 0) return positive
  const filtered = positive.filter(
    (value) => value >= center * 0.35 && value <= center * 2.5,
  )
  return filtered.length >= 2 ? filtered : positive
}

/** Taxas estimadas por ciclo. A compra atual nunca entra como consumo imediato. */
export function cycleConsumptionRates(samples: ConsumptionSample[]): number[] {
  const sorted = [...samples].sort((a, b) => a.date.getTime() - b.date.getTime())
  const rates: number[] = []
  for (let index = 1; index < sorted.length; index += 1) {
    const elapsed = daysBetween(sorted[index].date, sorted[index - 1].date)
    const previousQuantity = sorted[index - 1].quantity
    if (elapsed > 0 && previousQuantity > 0) rates.push(previousQuantity / elapsed)
  }
  return rates
}

export function estimateDailyConsumption(samples: ConsumptionSample[]): number | null {
  return mean(robustValues(cycleConsumptionRates(samples)))
}

/**
 * Detecta tendência de consumo a partir das quantidades por compra, usando a
 * inclinação de uma regressão linear normalizada pela média. Regras puras,
 * sem IA. Retorna 'estavel' quando não há sinal suficiente.
 */
export function detectQuantityTrend(quantities: number[]): TrendDirection {
  if (quantities.length < 3) return 'estavel'
  const slope = linearTrendSlope(quantities)
  const avg = mean(quantities)
  if (slope === null || avg === null || Math.abs(avg) < 1e-9) return 'estavel'
  const relative = slope / avg
  if (relative > TREND_RELATIVE_THRESHOLD) return 'aumentando'
  if (relative < -TREND_RELATIVE_THRESHOLD) return 'diminuindo'
  return 'estavel'
}

/** Tendência do consumo inferido, não da quantidade da compra atual. */
export function detectConsumptionTrend(rates: number[]): TrendDirection {
  return detectQuantityTrend(robustValues(rates))
}

/**
 * Calcula as métricas de consumo. Funciona mesmo com poucos dados:
 * - 0 ou 1 compra: sem consumo estimável (null), confiança tratada fora.
 * - >= 2 compras: estima consumo diário pela quantidade consumível sobre o
 *   tempo decorrido entre a primeira e a última compra.
 */
export function computeConsumption(
  samples: ConsumptionSample[],
): ConsumptionMetrics {
  const sorted = [...samples].sort((a, b) => a.date.getTime() - b.date.getTime())
  const quantities = sorted.map((s) => s.quantity)
  const dates = sorted.map((s) => s.date)
  const intervals = intervalsInDays(dates)
  const rates = cycleConsumptionRates(sorted)

  const quantityStats = describe(quantities)
  const intervalStats = describe(intervals)
  const rateStats = describe(rates)
  const averagePurchaseInterval = mean(intervals)
  const refillIntervals = robustValues(intervals)
  const averageRefillInterval = median(refillIntervals)
  const dailyAverage = estimateDailyConsumption(sorted)

  const monthlyAverage =
    dailyAverage === null ? null : dailyAverage * DAYS_PER_MONTH

  return {
    dailyAverage,
    monthlyAverage,
    quantityStats,
    intervalStats,
    rateStats,
    averagePurchaseInterval,
    averageRefillInterval,
    purchaseFrequencyPerMonth: purchasesPerMonth(averageRefillInterval),
    trend: detectConsumptionTrend(rates),
    seasonalityByMonth: seasonalityByMonth(sorted),
  }
}
