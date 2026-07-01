import test from 'node:test'
import assert from 'node:assert/strict'
import type { FlowItem } from './domain'
import { analyzeFlowVariation, flowComparisonWindow, scopeFlowItems } from './flow-analysis'

const item = (overrides: Partial<FlowItem> & Pick<FlowItem, 'key' | 'name' | 'totalPrice'>): FlowItem => ({
  quantity: 1,
  unit: 'kg',
  unitPrice: overrides.totalPrice,
  behaviorType: 'recorrente_mensal',
  estimatedDurationMonths: 1,
  comparableQuantity: 1,
  comparableUnit: 'kg',
  ...overrides,
})

test('decomposição concilia preço, quantidade, produtos novos e removidos até o centavo', () => {
  const reference = [
    item({ key: 'arroz', name: 'Arroz', totalPrice: 20, comparableQuantity: 2 }),
    item({ key: 'cafe', name: 'Café', totalPrice: 12 }),
  ]
  const current = [
    item({ key: 'arroz', name: 'Arroz', totalPrice: 36, comparableQuantity: 3 }),
    item({ key: 'leite', name: 'Leite', totalPrice: 8, comparableUnit: 'L' }),
  ]
  const result = analyzeFlowVariation(current, reference)
  const reconciled = result.components.reduce((sum, component) => sum + component.amount, 0)

  assert.equal(result.difference, 12)
  assert.equal(reconciled, result.difference)
  assert.equal(result.components.find((component) => component.type === 'price')?.amount, 6)
  assert.equal(result.components.find((component) => component.type === 'quantity')?.amount, 10)
  assert.equal(result.components.find((component) => component.type === 'new_products')?.amount, 8)
  assert.equal(result.components.find((component) => component.type === 'removed_products')?.amount, -12)
})

test('unidade incompatível não produz falsa separação entre preço e quantidade', () => {
  const result = analyzeFlowVariation(
    [item({ key: 'produto', name: 'Produto', totalPrice: 18, comparableQuantity: null, comparableUnit: null })],
    [item({ key: 'produto', name: 'Produto', totalPrice: 10 })],
  )
  const product = result.productImpacts[0]
  assert.equal(product.status, 'unit_incompatible')
  assert.equal(product.priceEffect, 0)
  assert.equal(product.quantityEffect, 0)
  assert.equal(product.mixEffect, 8)
  assert.equal(result.components.reduce((sum, component) => sum + component.amount, 0), 8)
})

test('períodos sem compras conciliam sem NaN', () => {
  const result = analyzeFlowVariation([], [])
  assert.equal(result.difference, 0)
  assert.equal(result.differencePercentage, null)
  assert.equal(result.productImpacts.length, 0)
})

test('mês corrente compara somente os mesmos dias do mês anterior', () => {
  const window = flowComparisonWindow(2026, 7, new Date('2026-07-10T15:00:00Z'))
  assert.equal(window.isPartial, true)
  assert.equal(window.throughDay, 10)
  assert.equal(window.selectedEnd.toISOString(), '2026-07-11T00:00:00.000Z')
  assert.equal(window.referenceEnd.toISOString(), '2026-06-11T00:00:00.000Z')
})

test('comparação aceita um mês de referência escolhido pelo usuário', () => {
  const window = flowComparisonWindow(
    2026,
    7,
    new Date('2026-07-10T15:00:00Z'),
    { year: 2026, month: 2 },
  )
  assert.equal(window.referenceStart.toISOString(), '2026-02-01T00:00:00.000Z')
  assert.equal(window.referenceEnd.toISOString(), '2026-02-11T00:00:00.000Z')
  assert.equal(window.comparisonKind, 'same_days_reference_month')
})

test('comparação continua proporcional quando o mês corrente é a referência', () => {
  const window = flowComparisonWindow(
    2026,
    6,
    new Date('2026-07-10T15:00:00Z'),
    { year: 2026, month: 7 },
  )
  assert.equal(window.selectedEnd.toISOString(), '2026-06-11T00:00:00.000Z')
  assert.equal(window.referenceEnd.toISOString(), '2026-07-11T00:00:00.000Z')
  assert.equal(window.isPartial, true)
})

test('escopo mantém somente o nó escolhido e seus descendentes informados', () => {
  const items = [
    item({ key: 'arroz', name: 'Arroz', totalPrice: 20, nodeId: 'arroz' }),
    item({ key: 'sabao', name: 'Sabão', totalPrice: 10, nodeId: 'sabao' }),
  ]
  assert.deepEqual(scopeFlowItems(items, new Set(['alimentos', 'arroz'])).map((entry) => entry.key), ['arroz'])
})
