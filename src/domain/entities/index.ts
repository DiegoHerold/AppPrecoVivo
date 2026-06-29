/**
 * Entidades do domínio do motor de inferência.
 *
 * São estruturas de dados puras (sem comportamento de I/O). Os repositories
 * convertem registros do Prisma nestas formas; o engine só conhece estas.
 */

import type {
  ConfidenceLevel,
  InferenceEventType,
  SeriesStats,
  StockStatus,
  TrendDirection,
} from '../types'

/**
 * Uma compra (reposição) de um produto, já normalizada para a unidade padrão
 * do produto quando possível. Representa o histórico ORIGINAL e imutável.
 */
export interface PurchaseRecord {
  id: string
  productId: string
  date: Date
  /** Quantidade já convertida para a unidade padrão do produto (quando deu). */
  quantity: number
  /** Unidade efetiva da quantidade acima. */
  unit: string
  /** false quando a unidade original não pôde ser convertida com segurança. */
  unitConverted: boolean
  unitPrice: number
  totalPrice: number
  storeId: string | null
  storeName: string | null
  category: string | null
  /** Origem do registro (importacao, manual, texto...). */
  origin: string
  notes: string | null
}

/**
 * Entrada de produto vinda da persistência, antes do cálculo de inferência.
 */
export interface ProductInput {
  id: string
  name: string
  normalizedName: string
  category: string | null
  standardUnit: string
}

/**
 * Evento de inferência derivado pelo motor. Nunca substitui uma compra;
 * referencia a compra que o originou (quando aplicável).
 */
export interface InferenceEvent {
  type: InferenceEventType
  productId: string
  /** Compra associada ao evento, se houver. */
  purchaseId: string | null
  date: Date
  /** Mensagem honesta para a interface. */
  message: string
  confidence: ConfidenceLevel
  /** Dados auxiliares calculados (dias de antecedência, falta etc.). */
  details: Record<string, number | string | null>
}

/**
 * Métricas de consumo de um produto. CONSUMO != REPOSIÇÃO.
 */
export interface ConsumptionMetrics {
  dailyAverage: number | null
  monthlyAverage: number | null
  /** Estatísticas das quantidades compradas (reposição). */
  quantityStats: SeriesStats
  /** Estatísticas dos intervalos entre compras (em dias). */
  intervalStats: SeriesStats
  /** Intervalo médio entre compras (dias). */
  averagePurchaseInterval: number | null
  /** Intervalo médio entre reposições efetivas (dias). */
  averageRefillInterval: number | null
  /** Frequência de compra: compras por mês. */
  purchaseFrequencyPerMonth: number | null
  trend: TrendDirection
  /** Consumo médio por mês-calendário (sazonalidade simples). */
  seasonalityByMonth: Record<number, number>
}

/**
 * Estado de estoque estimado de um produto.
 */
export interface InventoryState {
  estimatedStock: number
  unit: string
  daysRemaining: number | null
  status: StockStatus
  lastPurchaseDate: Date | null
  /** Data estimada em que o estoque chega a zero. */
  projectedDepletionDate: Date | null
}

/**
 * Visão completa de inferência de um produto — o que o motor entrega para os
 * dashboards. Tudo aqui é estimativa com confiança explícita.
 */
export interface ProductInference {
  productId: string
  name: string
  category: string | null
  unit: string
  consumption: ConsumptionMetrics
  inventory: InventoryState
  confidence: ConfidenceLevel
  purchaseCount: number
  refillCount: number
  lastPurchaseDate: Date | null
  averagePrice: number | null
  minPrice: number | null
  maxPrice: number | null
  events: InferenceEvent[]
}
