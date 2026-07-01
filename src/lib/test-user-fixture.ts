import type { BehaviorType, StoreType } from '@/generated/prisma/client'

export type TestProductSpec = {
  key: string
  name: string
  category: string
  defaultUnit: string
  behaviorType: BehaviorType
  estimatedDurationMonths: number
}

export type TestStoreSpec = {
  key: string
  name: string
  type: StoreType
  document: string
}

export type TestPurchaseItem = {
  productKey: string
  quantity: number
  unit: string
  unitPrice: number
  needsReview?: boolean
}

export type TestPurchaseDraft = {
  date: Date
  storeKey: string
  items: TestPurchaseItem[]
}

export const PRODUCTION_TEST_ACCOUNT_NAME = 'Conta de homologação'

export const TEST_STORES: TestStoreSpec[] = [
  { key: 'aurora', name: 'Mercado Aurora', type: 'mercado', document: 'TEST-HOMOLOG-001' },
  { key: 'central', name: 'Supermercado Central', type: 'mercado', document: 'TEST-HOMOLOG-002' },
  { key: 'economico', name: 'Atacado Econômico', type: 'atacado', document: 'TEST-HOMOLOG-003' },
  { key: 'farmacia', name: 'Farmácia Horizonte', type: 'farmacia', document: 'TEST-HOMOLOG-004' },
]

export const TEST_PRODUCTS: TestProductSpec[] = [
  { key: 'arroz', name: 'Arroz integral', category: 'Arroz', defaultUnit: 'kg', behaviorType: 'estoque', estimatedDurationMonths: 2 },
  { key: 'feijao', name: 'Feijão carioca', category: 'Feijão', defaultUnit: 'kg', behaviorType: 'recorrente_mensal', estimatedDurationMonths: 1 },
  { key: 'cafe', name: 'Café torrado', category: 'Bebidas', defaultUnit: 'kg', behaviorType: 'recorrente_mensal', estimatedDurationMonths: 1 },
  { key: 'azeite', name: 'Azeite de oliva', category: 'Temperos e Condimentos', defaultUnit: 'L', behaviorType: 'estoque', estimatedDurationMonths: 2 },
  { key: 'leite', name: 'Leite integral', category: 'Leite', defaultUnit: 'L', behaviorType: 'recorrente_semanal', estimatedDurationMonths: 1 },
  { key: 'ovos', name: 'Ovos brancos', category: 'Alimentação', defaultUnit: 'dz', behaviorType: 'recorrente_semanal', estimatedDurationMonths: 1 },
  { key: 'banana', name: 'Banana prata', category: 'Frutas', defaultUnit: 'kg', behaviorType: 'recorrente_semanal', estimatedDurationMonths: 1 },
  { key: 'frango', name: 'Filé de frango', category: 'Frango', defaultUnit: 'kg', behaviorType: 'recorrente_semanal', estimatedDurationMonths: 1 },
  { key: 'iogurte', name: 'Iogurte natural', category: 'Iogurte', defaultUnit: 'un', behaviorType: 'recorrente_semanal', estimatedDurationMonths: 1 },
  { key: 'granola', name: 'Granola tradicional', category: 'Aveia', defaultUnit: 'kg', behaviorType: 'recorrente_mensal', estimatedDurationMonths: 1 },
  { key: 'detergente', name: 'Detergente neutro', category: 'Limpeza', defaultUnit: 'un', behaviorType: 'recorrente_mensal', estimatedDurationMonths: 1 },
  { key: 'papel', name: 'Papel higiênico', category: 'Higiene', defaultUnit: 'pct', behaviorType: 'estoque', estimatedDurationMonths: 2 },
  { key: 'shampoo', name: 'Shampoo diário', category: 'Cuidados pessoais', defaultUnit: 'L', behaviorType: 'recorrente_mensal', estimatedDurationMonths: 1 },
  { key: 'desinfetante', name: 'Desinfetante lavanda', category: 'Limpeza', defaultUnit: 'L', behaviorType: 'estoque', estimatedDurationMonths: 2 },
  { key: 'analgesico', name: 'Analgésico', category: 'Medicamentos', defaultUnit: 'cx', behaviorType: 'emergencia', estimatedDurationMonths: 1 },
  { key: 'panetone', name: 'Panetone', category: 'Doces e Snacks', defaultUnit: 'un', behaviorType: 'sazonal', estimatedDurationMonths: 1 },
  { key: 'fone', name: 'Fone de ouvido', category: 'Utensílios', defaultUnit: 'un', behaviorType: 'pontual', estimatedDurationMonths: 1 },
]

const money = (value: number) => Math.round(value * 100) / 100

function monthStart(referenceDate: Date, offset: number) {
  return new Date(Date.UTC(referenceDate.getUTCFullYear(), referenceDate.getUTCMonth() + offset, 1, 12))
}

function purchaseDate(start: Date, day: number) {
  return new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), day, 12))
}

function currentMonthDay(referenceDate: Date, preferredDay: number) {
  return Math.min(referenceDate.getUTCDate(), preferredDay)
}

function gradual(base: number, monthIndex: number, extra = 0) {
  return money(base * (1 + monthIndex * 0.012 + extra))
}

/** Gera sempre a mesma história para a mesma data de referência. */
export function buildProductionTestFixture(referenceDate: Date) {
  if (Number.isNaN(referenceDate.getTime())) throw new Error('Data de referência inválida.')
  const purchases: TestPurchaseDraft[] = []

  for (let monthIndex = 0; monthIndex < 12; monthIndex += 1) {
    const start = monthStart(referenceDate, monthIndex - 11)
    const isCurrentMonth = monthIndex === 11
    const days = isCurrentMonth
      ? [...new Set([currentMonthDay(referenceDate, 3), currentMonthDay(referenceDate, 12), currentMonthDay(referenceDate, 24)])]
      : [3, 12, 24]
    const riceSpike = monthIndex === 10 ? 0.18 : 0
    const coffeeSpike = monthIndex >= 9 ? 0.22 : 0

    const firstItems: TestPurchaseItem[] = [
      { productKey: 'arroz', quantity: monthIndex === 6 ? 8 : 2, unit: 'kg', unitPrice: gradual(7.8, monthIndex, riceSpike) },
      { productKey: 'feijao', quantity: monthIndex === 5 ? 2 : 1, unit: 'kg', unitPrice: gradual(8.4, monthIndex) },
      monthIndex % 2 === 0
        ? { productKey: 'cafe', quantity: 500, unit: 'g', unitPrice: gradual(0.04, monthIndex, coffeeSpike) }
        : { productKey: 'cafe', quantity: 0.5, unit: 'kg', unitPrice: gradual(40, monthIndex, coffeeSpike) },
      monthIndex % 3 === 0
        ? { productKey: 'azeite', quantity: 500, unit: 'ml', unitPrice: gradual(0.08, monthIndex) }
        : { productKey: 'azeite', quantity: 0.5, unit: 'L', unitPrice: gradual(80, monthIndex) },
    ]
    if (monthIndex % 2 === 0) firstItems.push({ productKey: 'detergente', quantity: 2, unit: 'un', unitPrice: gradual(2.6, monthIndex) })
    if (monthIndex % 3 === 0) firstItems.push({ productKey: 'papel', quantity: 2, unit: 'pct', unitPrice: gradual(18, monthIndex) })
    if (start.getUTCMonth() === 11) firstItems.push({ productKey: 'panetone', quantity: 1, unit: 'un', unitPrice: 29.9 })

    const secondItems: TestPurchaseItem[] = [
      { productKey: 'ovos', quantity: 2, unit: 'dz', unitPrice: gradual(10.5, monthIndex) },
      { productKey: 'banana', quantity: 2, unit: 'kg', unitPrice: gradual(5.5, monthIndex) },
    ]
    if (monthIndex !== 7) secondItems.push({ productKey: 'leite', quantity: 4, unit: 'L', unitPrice: gradual(4.7, monthIndex) })
    if (monthIndex < 8) secondItems.push({ productKey: 'iogurte', quantity: 4, unit: 'un', unitPrice: gradual(2.8, monthIndex) })
    if (monthIndex >= 8) secondItems.push({ productKey: 'granola', quantity: 0.5, unit: 'kg', unitPrice: gradual(28, monthIndex) })
    if (monthIndex === 9) secondItems.push({ productKey: 'arroz', quantity: 2, unit: 'kg', unitPrice: gradual(7.8, monthIndex) })

    const thirdItems: TestPurchaseItem[] = [
      { productKey: 'frango', quantity: monthIndex === 4 ? 4 : 2, unit: 'kg', unitPrice: gradual(17.5, monthIndex) },
      { productKey: 'banana', quantity: 1.5, unit: 'kg', unitPrice: gradual(5.5, monthIndex) },
    ]
    if (monthIndex !== 7) thirdItems.push({ productKey: 'leite', quantity: 4, unit: 'L', unitPrice: gradual(4.7, monthIndex) })
    if (monthIndex % 2 === 0) thirdItems.push({ productKey: 'shampoo', quantity: 500, unit: 'ml', unitPrice: gradual(0.04, monthIndex) })
    if (monthIndex % 2 === 0) {
      thirdItems.push(monthIndex === 8
        ? { productKey: 'desinfetante', quantity: 2, unit: 'kg', unitPrice: 8.5, needsReview: true }
        : { productKey: 'desinfetante', quantity: 2, unit: 'L', unitPrice: gradual(8.5, monthIndex) })
    }
    if (monthIndex === 2 || monthIndex === 9) thirdItems.push({ productKey: 'analgesico', quantity: 1, unit: 'cx', unitPrice: gradual(14, monthIndex) })
    if (monthIndex === 6) thirdItems.push({ productKey: 'fone', quantity: 1, unit: 'un', unitPrice: 89.9 })

    const baskets = [firstItems, secondItems, thirdItems]
    days.forEach((day, basketIndex) => {
      const items = baskets[basketIndex]
      if (!items?.length) return
      purchases.push({
        date: purchaseDate(start, day),
        storeKey: TEST_STORES[(monthIndex + basketIndex) % TEST_STORES.length].key,
        items,
      })
    })
  }

  return {
    referenceDate: new Date(referenceDate),
    products: TEST_PRODUCTS,
    stores: TEST_STORES,
    purchases,
  }
}

export function fixtureMonthCount(purchases: TestPurchaseDraft[]) {
  return new Set(purchases.map((purchase) => `${purchase.date.getUTCFullYear()}-${purchase.date.getUTCMonth() + 1}`)).size
}
