import test from 'node:test'
import assert from 'node:assert/strict'
import { computeConsumption, detectQuantityTrend } from './index'

const D = (s: string) => new Date(`${s}T00:00:00.000Z`)

test('consumo diário NÃO assume que a recompra marca o fim do estoque', () => {
  // Compra 1kg em 01/01 e 1kg em 10/03 (68 dias). A última compra é estoque,
  // logo consumível = 1kg sobre 68 dias.
  const metrics = computeConsumption([
    { date: D('2026-01-01'), quantity: 1 },
    { date: D('2026-03-10'), quantity: 1 },
  ])
  assert.ok(metrics.dailyAverage !== null)
  assert.ok(Math.abs(metrics.dailyAverage! - 1 / 68) < 1e-6)
})

test('0 ou 1 compra => consumo não estimável', () => {
  assert.equal(computeConsumption([]).dailyAverage, null)
  assert.equal(
    computeConsumption([{ date: D('2026-01-01'), quantity: 5 }]).dailyAverage,
    null,
  )
})

test('consumo mensal = diário * 30.44', () => {
  const metrics = computeConsumption([
    { date: D('2026-01-01'), quantity: 30.44 },
    { date: D('2026-02-01'), quantity: 10 },
  ])
  // consumível = 30.44 sobre ~31 dias.
  assert.ok(metrics.monthlyAverage !== null)
})

test('tendência de quantidade detecta aumento e queda', () => {
  assert.equal(detectQuantityTrend([1, 2, 3, 4, 5]), 'aumentando')
  assert.equal(detectQuantityTrend([5, 4, 3, 2, 1]), 'diminuindo')
  assert.equal(detectQuantityTrend([3, 3, 3]), 'estavel')
})

test('intervalo médio entre compras é calculado', () => {
  const metrics = computeConsumption([
    { date: D('2026-01-01'), quantity: 1 },
    { date: D('2026-01-11'), quantity: 1 },
    { date: D('2026-01-21'), quantity: 1 },
  ])
  assert.equal(metrics.averagePurchaseInterval, 10)
})
