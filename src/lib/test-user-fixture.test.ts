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
})
