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
  matchConfidence?: number
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
  { key: 'feira', name: 'Feira do Bairro', type: 'loja', document: 'TEST-HOMOLOG-005' },
  { key: 'padaria', name: 'Padaria Vila Nova', type: 'padaria', document: 'TEST-HOMOLOG-006' },
]

export const TEST_PRODUCTS: TestProductSpec[] = [
  { key: 'arroz', name: 'Arroz integral', category: 'Arroz', defaultUnit: 'kg', behaviorType: 'estoque', estimatedDurationMonths: 2 },
  { key: 'feijao', name: 'Feijão carioca', category: 'Feijão', defaultUnit: 'kg', behaviorType: 'recorrente_mensal', estimatedDurationMonths: 1 },
  { key: 'cafe', name: 'Café torrado', category: 'Bebidas', defaultUnit: 'kg', behaviorType: 'recorrente_mensal', estimatedDurationMonths: 1 },
  { key: 'azeite', name: 'Azeite de oliva', category: 'Temperos e Condimentos', defaultUnit: 'L', behaviorType: 'estoque', estimatedDurationMonths: 2 },
  { key: 'leite', name: 'Leite integral', category: 'Leite', defaultUnit: 'L', behaviorType: 'recorrente_semanal', estimatedDurationMonths: 1 },
  { key: 'ovos', name: 'Ovos brancos', category: 'Alimentação', defaultUnit: 'dz', behaviorType: 'recorrente_semanal', estimatedDurationMonths: 1 },
  { key: 'banana', name: 'Banana prata', category: 'Frutas', defaultUnit: 'kg', behaviorType: 'recorrente_semanal', estimatedDurationMonths: 1 },
  { key: 'maca', name: 'Maçã gala', category: 'Frutas', defaultUnit: 'kg', behaviorType: 'recorrente_semanal', estimatedDurationMonths: 1 },
  { key: 'tomate', name: 'Tomate italiano', category: 'Legumes', defaultUnit: 'kg', behaviorType: 'recorrente_semanal', estimatedDurationMonths: 1 },
  { key: 'batata', name: 'Batata inglesa', category: 'Legumes', defaultUnit: 'kg', behaviorType: 'recorrente_semanal', estimatedDurationMonths: 1 },
  { key: 'alface', name: 'Alface crespa', category: 'Verduras', defaultUnit: 'un', behaviorType: 'recorrente_semanal', estimatedDurationMonths: 1 },
  { key: 'frango', name: 'Filé de frango', category: 'Frango', defaultUnit: 'kg', behaviorType: 'recorrente_semanal', estimatedDurationMonths: 1 },
  { key: 'carne', name: 'Patinho bovino', category: 'Bovinos', defaultUnit: 'kg', behaviorType: 'recorrente_semanal', estimatedDurationMonths: 1 },
  { key: 'porco', name: 'Lombo suíno', category: 'Suínos', defaultUnit: 'kg', behaviorType: 'recorrente_mensal', estimatedDurationMonths: 1 },
  { key: 'pao', name: 'Pão francês', category: 'Padaria', defaultUnit: 'kg', behaviorType: 'recorrente_semanal', estimatedDurationMonths: 1 },
  { key: 'queijo', name: 'Queijo muçarela', category: 'Queijo', defaultUnit: 'kg', behaviorType: 'recorrente_semanal', estimatedDurationMonths: 1 },
  { key: 'iogurte', name: 'Iogurte natural', category: 'Iogurte', defaultUnit: 'un', behaviorType: 'recorrente_semanal', estimatedDurationMonths: 1 },
  { key: 'granola', name: 'Granola tradicional', category: 'Aveia', defaultUnit: 'kg', behaviorType: 'recorrente_mensal', estimatedDurationMonths: 1 },
  { key: 'macarrao', name: 'Macarrão espaguete', category: 'Grãos e Cereais', defaultUnit: 'pct', behaviorType: 'recorrente_mensal', estimatedDurationMonths: 1 },
  { key: 'molho', name: 'Molho de tomate', category: 'Temperos e Condimentos', defaultUnit: 'un', behaviorType: 'recorrente_mensal', estimatedDurationMonths: 1 },
  { key: 'farinha', name: 'Farinha de trigo', category: 'Grãos e Cereais', defaultUnit: 'kg', behaviorType: 'recorrente_mensal', estimatedDurationMonths: 1 },
  { key: 'acucar', name: 'Açúcar cristal', category: 'Grãos e Cereais', defaultUnit: 'kg', behaviorType: 'recorrente_mensal', estimatedDurationMonths: 1 },
  { key: 'suco', name: 'Suco integral', category: 'Bebidas', defaultUnit: 'L', behaviorType: 'recorrente_mensal', estimatedDurationMonths: 1 },
  { key: 'biscoito', name: 'Biscoito integral', category: 'Doces e Snacks', defaultUnit: 'pct', behaviorType: 'recorrente_mensal', estimatedDurationMonths: 1 },
  { key: 'detergente', name: 'Detergente neutro', category: 'Limpeza', defaultUnit: 'un', behaviorType: 'recorrente_mensal', estimatedDurationMonths: 1 },
  { key: 'sabao', name: 'Sabão líquido para roupas', category: 'Limpeza', defaultUnit: 'L', behaviorType: 'estoque', estimatedDurationMonths: 2 },
  { key: 'amaciante', name: 'Amaciante concentrado', category: 'Limpeza', defaultUnit: 'L', behaviorType: 'estoque', estimatedDurationMonths: 2 },
  { key: 'papel', name: 'Papel higiênico', category: 'Higiene', defaultUnit: 'pct', behaviorType: 'estoque', estimatedDurationMonths: 2 },
  { key: 'sabonete', name: 'Sabonete', category: 'Higiene', defaultUnit: 'un', behaviorType: 'recorrente_mensal', estimatedDurationMonths: 1 },
  { key: 'creme_dental', name: 'Creme dental', category: 'Higiene', defaultUnit: 'un', behaviorType: 'recorrente_mensal', estimatedDurationMonths: 1 },
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
  return money(base * (1 + monthIndex * 0.009 + extra))
}

const demandProfiles = [0.78, 0.86, 0.94, 0.8, 0.99, 0.89, 1.08, 0.82, 0.95, 1.02, 1.14, 1]
const storePriceFactors: Record<string, number> = {
  economico: 0.94,
  aurora: 1,
  central: 1.04,
  feira: 0.97,
  padaria: 1.08,
  farmacia: 1.06,
}

function quantity(base: number, demand: number, discrete = false) {
  const value = base * demand
  return discrete ? Math.max(1, Math.round(value)) : Math.max(0.1, Math.round(value * 100) / 100)
}

function priced(base: number, monthIndex: number, storeKey: string, extra = 0) {
  return money(gradual(base, monthIndex, extra) * (storePriceFactors[storeKey] ?? 1))
}

/** Gera sempre a mesma história para a mesma data de referência. */
export function buildProductionTestFixture(referenceDate: Date) {
  if (Number.isNaN(referenceDate.getTime())) throw new Error('Data de referência inválida.')
  const purchases: TestPurchaseDraft[] = []

  for (let monthIndex = 0; monthIndex < 12; monthIndex += 1) {
    const start = monthStart(referenceDate, monthIndex - 11)
    const isCurrentMonth = monthIndex === 11
    const demand = demandProfiles[monthIndex]
    const riceSpike = monthIndex === 10 ? 0.18 : 0
    const coffeeSpike = monthIndex >= 9 ? 0.22 : 0
    const stockStore = monthIndex % 3 === 0 ? 'central' : monthIndex % 3 === 1 ? 'aurora' : 'economico'
    const freshStore = monthIndex % 2 === 0 ? 'feira' : 'aurora'
    const mainStore = monthIndex % 2 === 0 ? 'central' : 'economico'
    const stockItems: TestPurchaseItem[] = [
      { productKey: 'arroz', quantity: monthIndex === 6 ? 10 : quantity(4, demand), unit: 'kg', unitPrice: priced(7.8, monthIndex, stockStore, riceSpike) },
      { productKey: 'feijao', quantity: quantity(3, demand), unit: 'kg', unitPrice: priced(8.4, monthIndex, stockStore) },
      monthIndex % 2 === 0
        ? { productKey: 'cafe', quantity: 1000, unit: 'g', unitPrice: priced(0.04, monthIndex, stockStore, coffeeSpike) }
        : { productKey: 'cafe', quantity: 1, unit: 'kg', unitPrice: priced(40, monthIndex, stockStore, coffeeSpike) },
      { productKey: 'leite', quantity: quantity(10, demand, true), unit: 'L', unitPrice: priced(4.8, monthIndex, stockStore) },
      { productKey: 'macarrao', quantity: quantity(4, demand, true), unit: 'pct', unitPrice: priced(5.6, monthIndex, stockStore) },
      { productKey: 'molho', quantity: quantity(4, demand, true), unit: 'un', unitPrice: priced(4.2, monthIndex, stockStore) },
      { productKey: 'farinha', quantity: quantity(2, demand), unit: 'kg', unitPrice: priced(5.4, monthIndex, stockStore) },
      { productKey: 'acucar', quantity: quantity(2, demand), unit: 'kg', unitPrice: priced(4.9, monthIndex, stockStore) },
      { productKey: 'detergente', quantity: quantity(4, demand, true), unit: 'un', unitPrice: priced(2.7, monthIndex, stockStore) },
      { productKey: 'sabonete', quantity: quantity(6, demand, true), unit: 'un', unitPrice: priced(3.2, monthIndex, stockStore) },
      { productKey: 'creme_dental', quantity: 2, unit: 'un', unitPrice: priced(8.5, monthIndex, stockStore) },
    ]
    if (monthIndex % 2 === 0 || monthIndex === 6) {
      stockItems.push(
        { productKey: 'sabao', quantity: monthIndex === 6 ? 6 : 3, unit: 'L', unitPrice: priced(14.5, monthIndex, stockStore) },
        { productKey: 'amaciante', quantity: monthIndex === 6 ? 4 : 2, unit: 'L', unitPrice: priced(8.9, monthIndex, stockStore) },
        { productKey: 'papel', quantity: monthIndex === 6 ? 4 : 2, unit: 'pct', unitPrice: priced(21.5, monthIndex, stockStore) },
      )
    }
    if (monthIndex % 2 === 1) stockItems.push({ productKey: 'azeite', quantity: 500, unit: 'ml', unitPrice: priced(0.08, monthIndex, stockStore) })
    else stockItems.push({ productKey: 'azeite', quantity: 0.5, unit: 'L', unitPrice: priced(80, monthIndex, stockStore) })
    if (start.getUTCMonth() === 11) stockItems.push({ productKey: 'panetone', quantity: 2, unit: 'un', unitPrice: 32.9 })

    const freshItems: TestPurchaseItem[] = [
      { productKey: 'ovos', quantity: quantity(2, demand, true), unit: 'dz', unitPrice: priced(11.5, monthIndex, freshStore) },
      { productKey: 'banana', quantity: quantity(3, demand), unit: 'kg', unitPrice: priced(5.8, monthIndex, freshStore) },
      { productKey: 'maca', quantity: quantity(2, demand), unit: 'kg', unitPrice: priced(9.8, monthIndex, freshStore) },
      { productKey: 'tomate', quantity: quantity(2, demand), unit: 'kg', unitPrice: priced(8.5, monthIndex, freshStore) },
      { productKey: 'batata', quantity: quantity(2, demand), unit: 'kg', unitPrice: priced(6.7, monthIndex, freshStore) },
      { productKey: 'alface', quantity: quantity(2, demand, true), unit: 'un', unitPrice: priced(4.8, monthIndex, freshStore) },
      { productKey: 'frango', quantity: quantity(2.5, demand), unit: 'kg', unitPrice: priced(18.5, monthIndex, freshStore) },
      { productKey: 'pao', quantity: quantity(1.2, demand), unit: 'kg', unitPrice: priced(17.5, monthIndex, 'padaria') },
      monthIndex % 3 === 0
        ? { productKey: 'queijo', quantity: 500, unit: 'g', unitPrice: priced(0.052, monthIndex, freshStore), matchConfidence: 0.82 }
        : { productKey: 'queijo', quantity: 0.5, unit: 'kg', unitPrice: priced(52, monthIndex, freshStore) },
    ]
    if (monthIndex !== 7) freshItems.push({ productKey: 'leite', quantity: quantity(5, demand, true), unit: 'L', unitPrice: priced(4.9, monthIndex, freshStore) })
    if (monthIndex < 9) freshItems.push({ productKey: 'iogurte', quantity: quantity(6, demand, true), unit: 'un', unitPrice: priced(3.4, monthIndex, freshStore) })
    if (monthIndex >= 8) freshItems.push({ productKey: 'granola', quantity: 0.5, unit: 'kg', unitPrice: priced(30, monthIndex, freshStore) })

    const mainItems: TestPurchaseItem[] = [
      { productKey: 'carne', quantity: quantity(2, demand), unit: 'kg', unitPrice: priced(39.5, monthIndex, mainStore) },
      { productKey: 'porco', quantity: quantity(1.3, demand), unit: 'kg', unitPrice: priced(25.5, monthIndex, mainStore) },
      { productKey: 'frango', quantity: quantity(monthIndex === 4 ? 3.5 : 2, demand), unit: 'kg', unitPrice: priced(18.5, monthIndex, mainStore) },
      { productKey: 'ovos', quantity: 2, unit: 'dz', unitPrice: priced(11.5, monthIndex, mainStore) },
      { productKey: 'banana', quantity: quantity(2, demand), unit: 'kg', unitPrice: priced(5.8, monthIndex, mainStore) },
      { productKey: 'tomate', quantity: quantity(1.5, demand), unit: 'kg', unitPrice: priced(8.5, monthIndex, mainStore) },
      { productKey: 'pao', quantity: quantity(1, demand), unit: 'kg', unitPrice: priced(17.5, monthIndex, 'padaria') },
      { productKey: 'suco', quantity: quantity(4, demand, true), unit: 'L', unitPrice: priced(8.2, monthIndex, mainStore) },
      { productKey: 'biscoito', quantity: quantity(3, demand, true), unit: 'pct', unitPrice: priced(6.8, monthIndex, mainStore) },
    ]
    if (monthIndex !== 7) mainItems.push({ productKey: 'leite', quantity: quantity(5, demand, true), unit: 'L', unitPrice: priced(4.9, monthIndex, mainStore) })
    if (monthIndex % 2 === 0) mainItems.push({ productKey: 'shampoo', quantity: 500, unit: 'ml', unitPrice: priced(0.044, monthIndex, 'farmacia') })
    if (monthIndex % 2 === 0) {
      mainItems.push(monthIndex === 8
        ? { productKey: 'desinfetante', quantity: 2, unit: 'kg', unitPrice: 9.5, matchConfidence: 0.55, needsReview: true }
        : { productKey: 'desinfetante', quantity: 2, unit: 'L', unitPrice: priced(9.5, monthIndex, mainStore) })
    }
    if (monthIndex === 2 || monthIndex === 9) mainItems.push({ productKey: 'analgesico', quantity: 1, unit: 'cx', unitPrice: priced(18, monthIndex, 'farmacia') })
    if (monthIndex === 6) mainItems.push({ productKey: 'fone', quantity: 1, unit: 'un', unitPrice: 119.9 })

    const topUpItems: TestPurchaseItem[] = [
      { productKey: 'leite', quantity: quantity(5, demand, true), unit: 'L', unitPrice: priced(5.05, monthIndex, 'aurora') },
      { productKey: 'ovos', quantity: 1, unit: 'dz', unitPrice: priced(11.8, monthIndex, 'aurora') },
      { productKey: 'banana', quantity: quantity(2, demand), unit: 'kg', unitPrice: priced(6, monthIndex, freshStore) },
      { productKey: 'maca', quantity: quantity(1.5, demand), unit: 'kg', unitPrice: priced(10, monthIndex, freshStore) },
      { productKey: 'tomate', quantity: quantity(1.2, demand), unit: 'kg', unitPrice: priced(8.8, monthIndex, freshStore) },
      { productKey: 'alface', quantity: 1, unit: 'un', unitPrice: priced(5, monthIndex, freshStore) },
      { productKey: 'pao', quantity: quantity(1.1, demand), unit: 'kg', unitPrice: priced(17.8, monthIndex, 'padaria') },
      { productKey: 'iogurte', quantity: quantity(4, demand, true), unit: 'un', unitPrice: priced(3.5, monthIndex, 'aurora') },
    ]

    const preferredDays = monthIndex === 4 ? [1, 8, 16, 24] : monthIndex === 8 ? [1, 12, 21, 28] : [1, 10, 18, 26]
    let schedule = [
      { day: preferredDays[0], storeKey: stockStore, items: stockItems },
      { day: preferredDays[1], storeKey: freshStore, items: freshItems },
      { day: preferredDays[2], storeKey: mainStore, items: mainItems },
      { day: preferredDays[3], storeKey: 'padaria', items: topUpItems },
    ]
    if (monthIndex === 3) schedule = schedule.slice(0, 3)
    if (isCurrentMonth) {
      const throughDay = referenceDate.getUTCDate()
      schedule = schedule.filter((entry) => entry.day <= throughDay)
      if (!schedule.length) schedule = [{ day: currentMonthDay(referenceDate, 3), storeKey: stockStore, items: stockItems }]
    }
    for (const entry of schedule) {
      purchases.push({ date: purchaseDate(start, entry.day), storeKey: entry.storeKey, items: entry.items })
    }
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
