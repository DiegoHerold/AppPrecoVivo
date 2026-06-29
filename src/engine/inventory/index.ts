/**
 * Engine de estoque estimado.
 *
 * Regras obrigatórias:
 * 1. Toda compra SOMA ao estoque estimado (nunca zera por causa de nova compra).
 *    Ex.: estoque 3 kg + compra 5 kg = 8 kg.
 * 2. Entre compras, o estoque DIMINUI diariamente conforme o consumo estimado.
 * 3. O estoque pode ficar negativo no modelo de reconstrução — isso é sinal de
 *    "possível período sem produto", não um erro. Para exibição, o estoque
 *    corrente é limitado a >= 0.
 *
 * A reconstrução é uma função pura do histórico: dadas as compras e o consumo
 * diário estimado, devolve o estoque numa data de referência. Reexecutável a
 * qualquer momento sem efeitos colaterais.
 */

import type { InventoryState } from '../../domain/entities'
import type { StockStatus } from '../../domain/types'
import { addDays, daysBetween } from '../../domain/value-objects/dates'

export interface InventoryPurchase {
  date: Date
  quantity: number
}

export interface InventoryParams {
  purchases: InventoryPurchase[]
  /** Consumo diário estimado (unidade padrão/dia). null => sem decremento. */
  dailyConsumption: number | null
  unit: string
  /** Data de referência ("hoje" do cálculo). Injetada para ser determinística. */
  asOf: Date
  /** Dias considerados "recém abastecido" após a última compra. */
  recentRefillDays?: number
  /** Dias restantes a partir dos quais o produto é "próximo do fim". */
  lowStockDays?: number
}

/**
 * Reconstrói o estoque estimado caminhando pelo histórico em ordem cronológica:
 * a cada compra soma a quantidade; entre eventos subtrai consumo * dias.
 * Retorna o estoque (pode ser negativo) na data `asOf`.
 */
export function reconstructStock(params: InventoryParams): number {
  const { purchases, dailyConsumption, asOf } = params
  if (purchases.length === 0) return 0
  const sorted = [...purchases].sort((a, b) => a.date.getTime() - b.date.getTime())
  const consumption = dailyConsumption ?? 0

  let stock = 0
  let cursor = sorted[0].date
  for (const purchase of sorted) {
    // Consome o tempo decorrido desde o último evento até esta compra.
    const elapsed = daysBetween(purchase.date, cursor)
    stock -= consumption * elapsed
    stock += purchase.quantity
    cursor = purchase.date
  }
  // Consome do último evento até a data de referência.
  if (asOf.getTime() > cursor.getTime()) {
    stock -= consumption * daysBetween(asOf, cursor)
  }
  return stock
}

function classifyStatus(
  rawStock: number,
  daysRemaining: number | null,
  daysSinceLastPurchase: number | null,
  hasData: boolean,
  recentRefillDays: number,
  lowStockDays: number,
): StockStatus {
  if (!hasData) return 'sem_dados'
  if (rawStock <= 0) return 'possivel_falta'
  if (daysSinceLastPurchase !== null && daysSinceLastPurchase <= recentRefillDays) {
    return 'recem_abastecido'
  }
  if (daysRemaining !== null && daysRemaining <= lowStockDays) {
    return 'proximo_do_fim'
  }
  return 'saudavel'
}

export function computeInventory(params: InventoryParams): InventoryState {
  const {
    purchases,
    dailyConsumption,
    unit,
    asOf,
    recentRefillDays = 7,
    lowStockDays = 7,
  } = params

  if (purchases.length === 0) {
    return {
      estimatedStock: 0,
      unit,
      daysRemaining: null,
      status: 'sem_dados',
      lastPurchaseDate: null,
      projectedDepletionDate: null,
    }
  }

  const sorted = [...purchases].sort((a, b) => a.date.getTime() - b.date.getTime())
  const lastPurchaseDate = sorted[sorted.length - 1].date
  const rawStock = reconstructStock(params)
  const displayStock = Math.max(0, rawStock)

  const daysRemaining =
    dailyConsumption && dailyConsumption > 0
      ? displayStock / dailyConsumption
      : null

  const projectedDepletionDate =
    daysRemaining !== null ? addDays(asOf, daysRemaining) : null

  const daysSinceLastPurchase = daysBetween(asOf, lastPurchaseDate)

  const status = classifyStatus(
    rawStock,
    daysRemaining,
    daysSinceLastPurchase,
    dailyConsumption !== null,
    recentRefillDays,
    lowStockDays,
  )

  return {
    estimatedStock: displayStock,
    unit,
    daysRemaining,
    status,
    lastPurchaseDate,
    projectedDepletionDate,
  }
}
