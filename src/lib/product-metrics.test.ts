import test from 'node:test'
import assert from 'node:assert/strict'
import { normalizeProductPurchaseMetrics } from './product-metrics'

test('normaliza preço por ml para o preço por litro do produto', () => {
  assert.deepEqual(normalizeProductPurchaseMetrics({
    quantity: 500,
    unit: 'ml',
    unitPrice: 0.08,
    totalPrice: 40,
    defaultUnit: 'L',
  }), { quantity: 0.5, unitPrice: 80, comparable: true })
})

test('mantém o preço original quando as unidades são incompatíveis', () => {
  assert.deepEqual(normalizeProductPurchaseMetrics({
    quantity: 2,
    unit: 'kg',
    unitPrice: 9.5,
    totalPrice: 19,
    defaultUnit: 'L',
  }), { quantity: 2, unitPrice: 9.5, comparable: false })
})
