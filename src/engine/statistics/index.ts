/**
 * Engine de estatística — funções puras e determinísticas.
 *
 * Toda a matemática do motor mora aqui. Nada de Prisma, datas "agora" ou
 * efeitos colaterais. Entradas vazias retornam null em vez de NaN, para que a
 * camada de confiança possa degradar a previsão de forma honesta.
 */

import type { SeriesStats } from '../../domain/types'
import { daysBetween, monthIndex } from '../../domain/value-objects/dates'

export function mean(values: number[]): number | null {
  if (values.length === 0) return null
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

export function median(values: number[]): number | null {
  if (values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid]
}

/**
 * Desvio padrão amostral (n-1). Retorna null com menos de 2 observações,
 * pois dispersão exige pelo menos duas amostras.
 */
export function standardDeviation(values: number[]): number | null {
  if (values.length < 2) return null
  const avg = mean(values)!
  const variance =
    values.reduce((sum, value) => sum + (value - avg) ** 2, 0) /
    (values.length - 1)
  return Math.sqrt(variance)
}

/** Coeficiente de variação: dispersão relativa à média. null se média ~ 0. */
export function coefficientOfVariation(values: number[]): number | null {
  const avg = mean(values)
  const sd = standardDeviation(values)
  if (avg === null || sd === null || Math.abs(avg) < 1e-9) return null
  return sd / avg
}

/** Média móvel das últimas `window` observações (assume série em ordem temporal). */
export function movingAverage(values: number[], window = 3): number | null {
  if (values.length === 0) return null
  const slice = values.slice(-Math.max(1, window))
  return mean(slice)
}

export function describe(values: number[], window = 3): SeriesStats {
  return {
    count: values.length,
    mean: mean(values),
    median: median(values),
    stdDev: standardDeviation(values),
    coefficientOfVariation: coefficientOfVariation(values),
    min: values.length ? Math.min(...values) : null,
    max: values.length ? Math.max(...values) : null,
    movingAverage: movingAverage(values, window),
  }
}

/**
 * Intervalos (em dias) entre compras consecutivas. Espera datas em qualquer
 * ordem; ordena ascendentemente antes de calcular. Com N datas retorna N-1
 * intervalos.
 */
export function intervalsInDays(dates: Date[]): number[] {
  if (dates.length < 2) return []
  const sorted = [...dates].sort((a, b) => a.getTime() - b.getTime())
  const intervals: number[] = []
  for (let i = 1; i < sorted.length; i += 1) {
    intervals.push(daysBetween(sorted[i], sorted[i - 1]))
  }
  return intervals
}

/**
 * Compras por mês a partir do intervalo médio em dias.
 * Usa 30,44 dias/mês (média do ano). null quando não há intervalo.
 */
export function purchasesPerMonth(avgIntervalDays: number | null): number | null {
  if (avgIntervalDays === null || avgIntervalDays <= 0) return null
  return 30.44 / avgIntervalDays
}

/**
 * Regressão linear simples (mínimos quadrados). Retorna a inclinação (slope)
 * de y em função do índice x = 0..n-1. Usada para detectar tendência sem IA.
 * null com menos de 2 pontos.
 */
export function linearTrendSlope(values: number[]): number | null {
  const n = values.length
  if (n < 2) return null
  const xs = values.map((_, index) => index)
  const xMean = mean(xs)!
  const yMean = mean(values)!
  let numerator = 0
  let denominator = 0
  for (let i = 0; i < n; i += 1) {
    numerator += (xs[i] - xMean) * (values[i] - yMean)
    denominator += (xs[i] - xMean) ** 2
  }
  if (Math.abs(denominator) < 1e-9) return null
  return numerator / denominator
}

/**
 * Sazonalidade simples: quantidade média comprada por mês-calendário (1-12).
 * Não infere causa, apenas agrega o histórico por mês.
 */
export function seasonalityByMonth(
  samples: { date: Date; quantity: number }[],
): Record<number, number> {
  const buckets = new Map<number, number[]>()
  for (const sample of samples) {
    const m = monthIndex(sample.date)
    const arr = buckets.get(m) ?? []
    arr.push(sample.quantity)
    buckets.set(m, arr)
  }
  const result: Record<number, number> = {}
  for (const [m, arr] of buckets) {
    result[m] = mean(arr)!
  }
  return result
}
