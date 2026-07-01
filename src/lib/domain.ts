import type { BehaviorType } from '@/generated/prisma/client'

export type FlowItem = {
  key: string
  name: string
  purchaseId?: string
  quantity: number
  unit?: string
  unitPrice: number
  totalPrice: number
  behaviorType: BehaviorType
  estimatedDurationMonths: number
  purchaseDate?: Date
  comparableQuantity?: number | null
  comparableUnit?: string | null
  // nodeId é o nó PRODUTO do plano de contas ao qual o item pertence.
  // groupId é o grupo (parentId) desse nó — derivado da árvore, fonte única de classificação.
  nodeId?: string
  groupId?: string | null
}

export function normalizeProductName(value: string) {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\b(tipo|unidade|un|pct|pacote)\b/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function levenshtein(a: string, b: string) {
  const matrix = Array.from({ length: b.length + 1 }, (_, row) => [row])
  for (let column = 0; column <= a.length; column += 1) matrix[0][column] = column

  for (let row = 1; row <= b.length; row += 1) {
    for (let column = 1; column <= a.length; column += 1) {
      matrix[row][column] = b[row - 1] === a[column - 1]
        ? matrix[row - 1][column - 1]
        : Math.min(matrix[row - 1][column - 1], matrix[row][column - 1], matrix[row - 1][column]) + 1
    }
  }
  return matrix[b.length][a.length]
}

export function textSimilarity(a: string, b: string) {
  const left = normalizeProductName(a)
  const right = normalizeProductName(b)
  if (!left || !right) return 0
  if (left === right) return 1
  return Math.max(0, 1 - levenshtein(left, right) / Math.max(left.length, right.length))
}

function classificationTokens(value: string) {
  const aliases: Record<string, string> = {
    pap: 'papel', hig: 'higienico', macar: 'macarrao', refri: 'refrigerante', sab: 'sabao', det: 'detergente',
  }
  return normalizeProductName(value).split(' ').map((token) => aliases[token] ?? token).filter((token) => {
    if (!token || /^\d/.test(token)) return false
    return !['com', 'sem', 'para', 'tipo', 'marca', 'natural', 'tradicional'].includes(token)
  })
}

export function classificationSimilarity(a: string, b: string) {
  const left = classificationTokens(a)
  const right = classificationTokens(b)
  if (!left.length || !right.length) return 0
  const used = new Set<number>()
  let common = 0
  for (const token of left) {
    const index = right.findIndex((candidate, position) => !used.has(position) && (candidate === token || (candidate.length >= 5 && token.length >= 5 && candidate.slice(0, 5) === token.slice(0, 5))))
    if (index >= 0) { used.add(index); common += 1 }
  }
  const coverage = common / Math.min(left.length, right.length)
  const union = new Set([...left, ...right]).size
  const jaccard = common / Math.max(1, union)
  return Math.min(1, Math.max(textSimilarity(a, b), coverage * 0.75 + jaccard * 0.25))
}

export function suggestLearnedCategory(rawName: string, examples: { categoryId: string; names: string[] }[]) {
  const byCategory = new Map<string, number>()
  for (const example of examples) {
    const score = Math.max(0, ...example.names.map((name) => classificationSimilarity(name, rawName)))
    byCategory.set(example.categoryId, Math.max(byCategory.get(example.categoryId) ?? 0, score))
  }
  const ranked = [...byCategory.entries()].sort((left, right) => right[1] - left[1])
  const [best, runnerUp] = ranked
  if (!best || best[1] < 0.52 || best[1] - (runnerUp?.[1] ?? 0) < 0.07) return null
  return { categoryId: best[0], score: best[1] }
}

export function suggestProductBehavior(name: string): BehaviorType {
  const normalized = normalizeProductName(name)
  if (/arroz|feijao|oleo|sabao|papel higienico|racao/.test(normalized)) return 'estoque'
  if (/leite|pao|ovo|banana|frango|verdura|legume/.test(normalized)) return 'recorrente_semanal'
  if (/cafe|manteiga|creme dental|shampoo/.test(normalized)) return 'recorrente_mensal'
  if (/remedio|dipirona|paracetamol|antibiotico/.test(normalized)) return 'emergencia'
  return 'pontual'
}

export function estimateProductDuration(behavior: BehaviorType, name = '') {
  if (behavior !== 'estoque') return 1
  const normalized = normalizeProductName(name)
  if (/arroz|papel higienico|racao/.test(normalized)) return 2
  return 1.5
}

export function calculateEstimatedConsumption(item: Pick<FlowItem, 'totalPrice' | 'behaviorType' | 'estimatedDurationMonths'>) {
  if (item.behaviorType !== 'estoque') return item.totalPrice
  return item.totalPrice / Math.max(1, item.estimatedDurationMonths)
}

function aggregate(items: FlowItem[]) {
  const map = new Map<string, { quantity: number; total: number; priceTotal: number; count: number; item: FlowItem }>()
  for (const item of items) {
    const current = map.get(item.key) ?? { quantity: 0, total: 0, priceTotal: 0, count: 0, item }
    current.quantity += item.quantity
    current.total += item.totalPrice
    current.priceTotal += item.unitPrice
    current.count += 1
    map.set(item.key, current)
  }
  return map
}

export function calculateMonthlyFlow(current: FlowItem[], previous: FlowItem[]) {
  const totalSpent = current.reduce((sum, item) => sum + item.totalPrice, 0)
  const estimatedConsumption = current.reduce((sum, item) => sum + calculateEstimatedConsumption(item), 0)
  const stockAmount = totalSpent - estimatedConsumption
  const recurringAmount = current
    .filter((item) => item.behaviorType.startsWith('recorrente'))
    .reduce((sum, item) => sum + item.totalPrice, 0)
  const punctualAmount = current
    .filter((item) => ['pontual', 'emergencia', 'fora_do_padrao'].includes(item.behaviorType))
    .reduce((sum, item) => sum + item.totalPrice, 0)

  const now = aggregate(current)
  const before = aggregate(previous)
  let quantityIncreaseAmount = 0
  let priceIncreaseAmount = 0

  for (const [key, value] of now) {
    const prior = before.get(key)
    if (!prior) continue
    const currentPrice = value.priceTotal / value.count
    const previousPrice = prior.priceTotal / prior.count
    if (value.quantity > prior.quantity) quantityIncreaseAmount += (value.quantity - prior.quantity) * currentPrice
    if (currentPrice > previousPrice) priceIncreaseAmount += (currentPrice - previousPrice) * Math.min(value.quantity, prior.quantity)
  }

  return {
    totalSpent,
    previousTotalSpent: previous.reduce((sum, item) => sum + item.totalPrice, 0),
    estimatedConsumption,
    stockAmount,
    recurringAmount,
    punctualAmount,
    priceIncreaseAmount,
    quantityIncreaseAmount,
  }
}

export function explainMonthlyDifference(current: FlowItem[], previous: FlowItem[]) {
  const flow = calculateMonthlyFlow(current, previous)
  return [
    { type: 'estoque' as const, title: 'Compra de estoque', amount: flow.stockAmount, description: 'Itens que devem durar mais de um mês.' },
    { type: 'quantidade' as const, title: 'Maior quantidade', amount: flow.quantityIncreaseAmount, description: 'Você comprou mais unidades, não necessariamente pagou mais caro.' },
    { type: 'pontual' as const, title: 'Compras pontuais', amount: flow.punctualAmount, description: 'Itens que não fazem parte do consumo recorrente.' },
    { type: 'preco' as const, title: 'Preço maior no seu histórico', amount: flow.priceIncreaseAmount, description: 'Comparação apenas com seus próprios preços anteriores.' },
  ]
}

export function detectOutOfPatternProducts(current: FlowItem[], previous: FlowItem[]) {
  const now = aggregate(current)
  const before = aggregate(previous)
  return [...now.entries()].filter(([key, value]) => {
    const prior = before.get(key)
    return value.item.behaviorType === 'fora_do_padrao' || !prior || value.quantity > prior.quantity * 1.5
  }).map(([, value]) => value.item)
}
