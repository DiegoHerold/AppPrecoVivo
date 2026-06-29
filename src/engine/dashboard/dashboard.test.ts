import assert from 'node:assert/strict'
import test from 'node:test'
import type { ProductInput, PurchaseRecord } from '../../domain/entities'
import { inferProduct } from '..'
import { aggregateDashboardSnapshot } from '.'

const date = (value: string) => new Date(`${value}T00:00:00.000Z`)

function product(id: string, category: string): ProductInput {
  return {
    id,
    name: `Produto ${id}`,
    normalizedName: `produto-${id}`,
    category,
    standardUnit: 'un',
    behaviorType: 'recorrente_mensal',
  }
}

function purchase(input: {
  id: string
  purchaseId: string
  productId: string
  date: string
  quantity: number
  unitPrice: number
}): PurchaseRecord {
  return {
    id: input.id,
    purchaseId: input.purchaseId,
    productId: input.productId,
    date: date(input.date),
    quantity: input.quantity,
    unit: 'un',
    unitConverted: true,
    unitPrice: input.unitPrice,
    totalPrice: input.quantity * input.unitPrice,
    storeId: 'store-1',
    storeName: 'Loja real',
    category: 'Casa',
    origin: 'manual',
    notes: null,
  }
}

test('dashboard agrega notas únicas, produtos e consumo estimado sem confundir reposição', () => {
  const asOf = date('2026-06-29')
  const products = [product('a', 'Casa'), product('b', 'Casa')]
  const purchases = [
    purchase({ id: 'line-old', purchaseId: 'invoice-old', productId: 'a', date: '2026-05-29', quantity: 2, unitPrice: 10 }),
    purchase({ id: 'line-a', purchaseId: 'invoice-current', productId: 'a', date: '2026-06-28', quantity: 2, unitPrice: 10 }),
    purchase({ id: 'line-b', purchaseId: 'invoice-current', productId: 'b', date: '2026-06-28', quantity: 3, unitPrice: 10 }),
  ]
  const inferences = products.map((item) =>
    inferProduct({
      product: item,
      purchases: purchases.filter((entry) => entry.productId === item.id),
      asOf,
    }),
  )

  const dashboard = aggregateDashboardSnapshot({ inferences, purchases, asOf })
  assert.equal(dashboard.currentMonth.totalSpent, 50)
  assert.equal(dashboard.currentMonth.productsPurchased, 2)
  assert.equal(dashboard.currentMonth.purchaseCount, 1)
  assert.equal(dashboard.recentlyRefilled.length, 2)
  assert.equal(dashboard.topStores[0].purchaseCount, 2)
  assert.ok(dashboard.topConsumingCategories[0].estimatedMonthlyCost > 0)
})
