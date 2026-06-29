import test from 'node:test'
import assert from 'node:assert/strict'
import { computeInventory, reconstructStock } from './index'

const D = (s: string) => new Date(`${s}T00:00:00.000Z`)

test('nova compra SOMA ao estoque (não zera): 3kg + 5kg = 8kg sem consumo', () => {
  const stock = reconstructStock({
    purchases: [
      { date: D('2026-01-01'), quantity: 3 },
      { date: D('2026-01-01'), quantity: 5 },
    ],
    dailyConsumption: 0,
    unit: 'kg',
    asOf: D('2026-01-01'),
  })
  assert.equal(stock, 8)
})

test('estoque diminui diariamente conforme o consumo estimado', () => {
  // Compra 10kg, consumo 1kg/dia, 4 dias depois => 6kg.
  const stock = reconstructStock({
    purchases: [{ date: D('2026-01-01'), quantity: 10 }],
    dailyConsumption: 1,
    unit: 'kg',
    asOf: D('2026-01-05'),
  })
  assert.equal(stock, 6)
})

test('estoque pode ficar negativo no modelo (sinal de possível falta)', () => {
  const stock = reconstructStock({
    purchases: [{ date: D('2026-01-01'), quantity: 5 }],
    dailyConsumption: 1,
    unit: 'kg',
    asOf: D('2026-01-20'),
  })
  assert.equal(stock, -14)
})

test('computeInventory limita exibição a >= 0 e marca possivel_falta', () => {
  const inv = computeInventory({
    purchases: [{ date: D('2026-01-01'), quantity: 5 }],
    dailyConsumption: 1,
    unit: 'kg',
    asOf: D('2026-01-20'),
  })
  assert.equal(inv.estimatedStock, 0)
  assert.equal(inv.status, 'possivel_falta')
})

test('produto recém comprado fica recem_abastecido', () => {
  const inv = computeInventory({
    purchases: [{ date: D('2026-06-28'), quantity: 10 }],
    dailyConsumption: 0.2,
    unit: 'kg',
    asOf: D('2026-06-29'),
  })
  assert.equal(inv.status, 'recem_abastecido')
  assert.ok(inv.daysRemaining! > 7)
})

test('dias restantes = estoque / consumo diário', () => {
  const inv = computeInventory({
    purchases: [{ date: D('2026-06-01'), quantity: 10 }],
    dailyConsumption: 1,
    unit: 'kg',
    asOf: D('2026-06-05'),
  })
  // 10 - 4 = 6 kg restantes, consumo 1/dia => 6 dias.
  assert.equal(inv.estimatedStock, 6)
  assert.equal(inv.daysRemaining, 6)
})

test('sem dados retorna status sem_dados', () => {
  const inv = computeInventory({
    purchases: [],
    dailyConsumption: null,
    unit: 'un',
    asOf: D('2026-06-05'),
  })
  assert.equal(inv.status, 'sem_dados')
  assert.equal(inv.daysRemaining, null)
})
