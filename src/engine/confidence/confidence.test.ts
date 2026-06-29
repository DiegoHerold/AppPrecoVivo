import test from 'node:test'
import assert from 'node:assert/strict'
import { classifyConfidence, formatEstimate } from './index'

test('menos de 2 compras => muito_baixa', () => {
  assert.equal(
    classifyConfidence({ purchaseCount: 1, intervalCoefficientOfVariation: null }),
    'muito_baixa',
  )
})

test('2 ou 3 ciclos => baixa', () => {
  assert.equal(
    classifyConfidence({ purchaseCount: 3, intervalCoefficientOfVariation: 0.1 }),
    'baixa',
  )
})

test('4 a 8 ciclos => media', () => {
  assert.equal(
    classifyConfidence({ purchaseCount: 7, intervalCoefficientOfVariation: 0.1 }),
    'media',
  )
})

test('mais de 10 ciclos => alta', () => {
  assert.equal(
    classifyConfidence({ purchaseCount: 14, intervalCoefficientOfVariation: 0.1 }),
    'alta',
  )
})

test('variação alta domina e marca instavel', () => {
  assert.equal(
    classifyConfidence({ purchaseCount: 15, intervalCoefficientOfVariation: 0.9 }),
    'instavel',
  )
})

test('formatEstimate produz texto honesto em pt-BR', () => {
  assert.equal(formatEstimate(2.34, 'kg'), 'aproximadamente 2,3 kg')
})
