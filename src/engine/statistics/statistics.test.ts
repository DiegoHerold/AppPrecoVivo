import test from 'node:test'
import assert from 'node:assert/strict'
import {
  coefficientOfVariation,
  describe as describeSeries,
  intervalsInDays,
  linearTrendSlope,
  mean,
  median,
  movingAverage,
  purchasesPerMonth,
  seasonalityByMonth,
  standardDeviation,
} from './index'

test('média, mediana e desvio padrão básicos', () => {
  assert.equal(mean([2, 4, 6]), 4)
  assert.equal(median([1, 3, 2]), 2)
  assert.equal(median([1, 2, 3, 4]), 2.5)
  assert.ok(Math.abs(standardDeviation([2, 4, 6])! - 2) < 1e-9)
})

test('séries vazias ou insuficientes retornam null (sem NaN)', () => {
  assert.equal(mean([]), null)
  assert.equal(median([]), null)
  assert.equal(standardDeviation([5]), null)
  assert.equal(coefficientOfVariation([]), null)
})

test('média móvel usa apenas as últimas N observações', () => {
  assert.equal(movingAverage([1, 2, 3, 10, 20], 2), 15)
})

test('intervalos entre datas em dias, independente da ordem', () => {
  const intervals = intervalsInDays([
    new Date('2026-01-11'),
    new Date('2026-01-01'),
    new Date('2026-01-21'),
  ])
  assert.deepEqual(intervals, [10, 10])
})

test('inclinação de tendência detecta crescimento e queda', () => {
  assert.ok(linearTrendSlope([1, 2, 3, 4])! > 0)
  assert.ok(linearTrendSlope([4, 3, 2, 1])! < 0)
  assert.equal(linearTrendSlope([5]), null)
})

test('compras por mês derivam do intervalo médio', () => {
  assert.ok(Math.abs(purchasesPerMonth(30.44)! - 1) < 1e-6)
  assert.equal(purchasesPerMonth(null), null)
})

test('sazonalidade agrega por mês-calendário', () => {
  const result = seasonalityByMonth([
    { date: new Date('2025-01-10'), quantity: 2 },
    { date: new Date('2026-01-10'), quantity: 4 },
    { date: new Date('2026-06-10'), quantity: 9 },
  ])
  assert.equal(result[1], 3)
  assert.equal(result[6], 9)
})

test('describe entrega um pacote completo de métricas', () => {
  const stats = describeSeries([10, 12, 14])
  assert.equal(stats.count, 3)
  assert.equal(stats.mean, 12)
  assert.equal(stats.min, 10)
  assert.equal(stats.max, 14)
})
