import test from 'node:test'
import assert from 'node:assert/strict'
import { buildProductionTestFixture, fixtureMonthCount } from './test-user-fixture'

test('fixture de produção é determinística e cobre doze meses', () => {
  const date = new Date('2026-07-18T12:00:00Z')
  const first = buildProductionTestFixture(date)
  const second = buildProductionTestFixture(date)
  assert.deepEqual(first, second)
  assert.equal(fixtureMonthCount(first.purchases), 12)
  assert.equal(first.products.length >= 15, true)
  assert.equal(first.stores.length >= 3, true)
})

test('meses completos representam um orçamento doméstico próximo de mil reais', () => {
  const fixture = buildProductionTestFixture(new Date('2026-07-18T12:00:00Z'))
  const totals = new Map<string, number>()
  for (const purchase of fixture.purchases) {
    const key = `${purchase.date.getUTCFullYear()}-${purchase.date.getUTCMonth() + 1}`
    const total = purchase.items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0)
    totals.set(key, (totals.get(key) ?? 0) + total)
  }
  const fullMonths = [...totals.entries()].filter(([key]) => key !== '2026-7').map(([, total]) => total)
  const average = fullMonths.reduce((sum, total) => sum + total, 0) / fullMonths.length
  assert.equal(average >= 900 && average <= 1150, true)
  assert.equal(Math.min(...fullMonths) < 900, true)
  assert.equal(Math.max(...fullMonths) > 1200, true)
})

test('mês atual nunca recebe compras futuras e permanece parcial', () => {
  const date = new Date('2026-07-10T12:00:00Z')
  const fixture = buildProductionTestFixture(date)
  const current = fixture.purchases.filter((purchase) => purchase.date.getUTCFullYear() === 2026 && purchase.date.getUTCMonth() === 6)
  assert.equal(current.length > 0, true)
  assert.equal(current.every((purchase) => purchase.date.getUTCDate() <= 10), true)
  assert.equal(current.some((purchase) => purchase.date.getUTCDate() === 10), true)
})

test('fixture contém normalização, incompatibilidade, sazonalidade, emergência e compras pontuais', () => {
  const fixture = buildProductionTestFixture(new Date('2026-07-18T12:00:00Z'))
  const items = fixture.purchases.flatMap((purchase) => purchase.items)
  assert.equal(items.some((item) => item.unit === 'g'), true)
  assert.equal(items.some((item) => item.unit === 'ml'), true)
  assert.equal(items.some((item) => item.productKey === 'desinfetante' && item.unit === 'kg'), true)
  assert.equal(items.some((item) => item.productKey === 'panetone'), true)
  assert.equal(items.some((item) => item.productKey === 'analgesico'), true)
  assert.equal(items.some((item) => item.productKey === 'fone'), true)
  assert.equal(items.some((item) => item.matchConfidence === 0.82), true)
  assert.equal(items.some((item) => item.matchConfidence === 0.55), true)
})
