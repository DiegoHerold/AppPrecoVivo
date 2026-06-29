import test from 'node:test'
import assert from 'node:assert/strict'
import { inferProduct } from './index'
import type { ProductInput, PurchaseRecord } from '../domain/entities'

const D = (s: string) => new Date(`${s}T00:00:00.000Z`)

const product: ProductInput = {
  id: 'p1',
  name: 'Arroz',
  normalizedName: 'arroz',
  category: 'Mercearia',
  standardUnit: 'kg',
  behaviorType: 'estoque',
}

function purchase(
  id: string,
  date: string,
  quantity: number,
  unitPrice = 25,
): PurchaseRecord {
  return {
    id,
    purchaseId: `purchase-${id}`,
    productId: 'p1',
    date: D(date),
    quantity,
    unit: 'kg',
    unitConverted: true,
    unitPrice,
    totalPrice: unitPrice * quantity,
    storeId: 's1',
    storeName: 'Mercado X',
    category: 'Mercearia',
    origin: 'importacao',
    notes: null,
  }
}

test('separa reposição de consumo e calcula confiança baixa com poucos dados', () => {
  const inference = inferProduct({
    product,
    purchases: [purchase('a', '2026-01-01', 5), purchase('b', '2026-03-10', 5)],
    asOf: D('2026-03-10'),
  })
  assert.equal(inference.purchaseCount, 2)
  assert.equal(inference.refillCount, 1) // reposição != nº de compras
  assert.equal(inference.confidence, 'baixa')
  // Estoque recém comprado = 5kg (compra do dia ainda não consumida).
  assert.ok(inference.inventory.estimatedStock >= 5)
})

test('detecta compra antecipada sem distorcer drasticamente o consumo', () => {
  // Regular a cada ~30 dias, depois uma compra após 10 dias com estoque sobrando.
  const inference = inferProduct({
    product,
    purchases: [
      purchase('a', '2026-01-01', 1),
      purchase('b', '2026-02-01', 1),
      purchase('c', '2026-03-01', 1),
      purchase('d', '2026-03-11', 1), // 10 dias depois => antecipada
    ],
    asOf: D('2026-03-11'),
  })
  const hasEarly = inference.events.some((e) => e.type === 'compra_antecipada')
  assert.ok(hasEarly)
  assert.ok(inference.consumption.dailyAverage! < 0.04)
})

test('detecta possível período sem produto em compra muito tardia', () => {
  // Consumo ~1kg/15 dias; some por muito tempo e o estoque esgota antes da recompra.
  const inference = inferProduct({
    product,
    purchases: [
      purchase('a', '2026-01-01', 1),
      purchase('b', '2026-01-16', 1),
      purchase('c', '2026-04-30', 1), // muito tardia
    ],
    asOf: D('2026-04-30'),
  })
  const shortage = inference.events.some(
    (e) => e.type === 'possivel_periodo_sem_produto',
  )
  assert.ok(shortage)
  assert.ok(inference.events.some((e) => e.type === 'compra_tardia'))
})

test('detecta compra em grande volume sem concluir aumento de consumo', () => {
  const inference = inferProduct({
    product,
    purchases: [
      purchase('a', '2026-01-01', 1),
      purchase('b', '2026-02-01', 1),
      purchase('c', '2026-03-01', 1),
      purchase('d', '2026-04-01', 5), // 5x a mediana
    ],
    asOf: D('2026-04-01'),
  })
  const bulk = inference.events.some((e) => e.type === 'compra_grande_volume')
  assert.ok(bulk)
  assert.notEqual(inference.consumption.trend, 'aumentando')
})

test('funciona com produto sem compras (baixa confiança, sem crash)', () => {
  const inference = inferProduct({
    product,
    purchases: [],
    asOf: D('2026-06-01'),
  })
  assert.equal(inference.confidence, 'muito_baixa')
  assert.equal(inference.inventory.status, 'sem_dados')
  assert.equal(inference.consumption.dailyAverage, null)
})

test('preços agregados: médio, mínimo e máximo', () => {
  const inference = inferProduct({
    product,
    purchases: [
      purchase('a', '2026-01-01', 1, 20),
      purchase('b', '2026-02-01', 1, 30),
    ],
    asOf: D('2026-02-01'),
  })
  assert.equal(inference.minPrice, 20)
  assert.equal(inference.maxPrice, 30)
  assert.equal(inference.averagePrice, 25)
})

test('preserva compra com unidade incompatível, mas não a mistura no estoque', () => {
  const incompatible = purchase('b', '2026-02-01', 20)
  incompatible.unit = 'L'
  incompatible.unitConverted = false
  const inference = inferProduct({
    product,
    purchases: [purchase('a', '2026-01-01', 5), incompatible],
    asOf: D('2026-02-01'),
  })
  assert.equal(inference.purchaseCount, 2)
  assert.equal(inference.usablePurchaseCount, 1)
  assert.equal(inference.confidence, 'muito_baixa')
  assert.equal(inference.inventory.estimatedStock, 5)
})

test('registra compras sazonais e emergenciais sem transformá-las em consumo', () => {
  const purchases = [purchase('a', '2026-01-01', 1)]
  const seasonal = inferProduct({
    product: { ...product, behaviorType: 'sazonal' },
    purchases,
    asOf: D('2026-01-01'),
  })
  const emergency = inferProduct({
    product: { ...product, behaviorType: 'emergencia' },
    purchases,
    asOf: D('2026-01-01'),
  })
  assert.ok(seasonal.events.some((event) => event.type === 'compra_sazonal'))
  assert.ok(emergency.events.some((event) => event.type === 'compra_emergencia'))
  assert.equal(seasonal.consumption.dailyAverage, null)
  assert.equal(emergency.consumption.dailyAverage, null)
})
