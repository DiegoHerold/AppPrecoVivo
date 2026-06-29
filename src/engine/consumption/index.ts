/**
 * Engine de consumo — estima QUANTO se consome por dia/mês a partir do
 * histórico de reposições. É recalculado sempre que novas compras entram.
 *
 * Premissa central e honesta: a próxima compra NÃO marca o dia exato em que o
 * produto acabou. Por isso o consumo é estimado pela quantidade reposta ao
 * longo do tempo decorrido, e não por "estoque zerou na data da recompra".
 *
 * Modelo: consumo diário ≈ (quantidade total consumível) / (tempo decorrido).
 * Excluímos a última compra do numerador porque ela ainda não foi consumida
 * (vira estoque). Assim "reposição" e "consumo" nunca se confundem.
 */

import type { ConsumptionMetrics } from '../../domain/entities'
import type { TrendDirection } from '../../domain/types'
import { daysBetween } from '../../domain/value-objects/dates'
import {
  describe,
  intervalsInDays,
  linearTrendSlope,
  mean,
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

  const quantityStats = describe(quantities)
  const intervalStats = describe(intervals)
  const averagePurchaseInterval = mean(intervals)

  let dailyAverage: number | null = null
  if (sorted.length >= 2) {
    const elapsedDays = daysBetween(
      sorted[sorted.length - 1].date,
      sorted[0].date,
    )
    // Quantidade já consumível = tudo menos a última compra (ainda em estoque).
    const consumable = quantities
      .slice(0, -1)
      .reduce((sum, q) => sum + q, 0)
    if (elapsedDays > 0 && consumable > 0) {
      dailyAverage = consumable / elapsedDays
    }
  }

  const monthlyAverage =
    dailyAverage === null ? null : dailyAverage * DAYS_PER_MONTH

  return {
    dailyAverage,
    monthlyAverage,
    quantityStats,
    intervalStats,
    averagePurchaseInterval,
    // Reposição efetiva = mesmo conjunto de intervalos aqui; mantido separado
    // semanticamente para evolução futura (ex.: ignorar compras antecipadas).
    averageRefillInterval: averagePurchaseInterval,
    purchaseFrequencyPerMonth: purchasesPerMonth(averagePurchaseInterval),
    trend: detectQuantityTrend(quantities),
    seasonalityByMonth: seasonalityByMonth(sorted),
  }
}
