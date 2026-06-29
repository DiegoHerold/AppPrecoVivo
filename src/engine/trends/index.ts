/**
 * Eventos explicáveis derivados do histórico. Cada compra é avaliada apenas
 * com os dados anteriores a ela, evitando vazamento do futuro no diagnóstico.
 */

import type { ConsumptionMetrics, InferenceEvent } from '../../domain/entities'
import type {
  ConfidenceLevel,
  InferenceEventType,
  ProductBehavior,
} from '../../domain/types'
import { daysBetween } from '../../domain/value-objects/dates'
import { computeConsumption } from '../consumption'
import { reconstructStock } from '../inventory'
import { median } from '../statistics'

export interface PurchasePoint {
  id: string
  date: Date
  quantity: number
}

export interface EventDetectionParams {
  productId: string
  purchases: PurchasePoint[]
  consumption: ConsumptionMetrics
  confidence: ConfidenceLevel
  dailyConsumption: number | null
  behaviorType?: ProductBehavior
}

const EARLY_RATIO = 0.6
const LATE_RATIO = 1.5
const BULK_MEDIAN_MULTIPLE = 2.5
const SHORTAGE_MIN_DAYS = 1

function buildEvent(
  type: InferenceEventType,
  params: {
    productId: string
    purchaseId: string | null
    date: Date
    title: string
    description: string
    impact: string
    confidence: ConfidenceLevel
    details?: Record<string, number | string | null>
  },
): InferenceEvent {
  return {
    type,
    productId: params.productId,
    purchaseId: params.purchaseId,
    date: params.date,
    title: params.title,
    description: params.description,
    impact: params.impact,
    message: params.description,
    confidence: params.confidence,
    details: params.details ?? {},
  }
}

function contextualEvent(
  behaviorType: ProductBehavior | undefined,
  productId: string,
  purchase: PurchasePoint,
  confidence: ConfidenceLevel,
): InferenceEvent | null {
  if (behaviorType === 'emergencia') {
    return buildEvent('compra_emergencia', {
      productId,
      purchaseId: purchase.id,
      date: purchase.date,
      title: 'Possível compra de emergência',
      description: 'A compra foi registrada como emergencial no plano do produto.',
      impact: 'O estoque aumenta, mas o evento não redefine sozinho o consumo médio.',
      confidence,
    })
  }
  if (behaviorType === 'sazonal') {
    return buildEvent('compra_sazonal', {
      productId,
      purchaseId: purchase.id,
      date: purchase.date,
      title: 'Possível compra sazonal',
      description: 'A compra pertence a um produto marcado como sazonal.',
      impact: 'A sazonalidade fica registrada sem transformar a compra em consumo recorrente.',
      confidence,
    })
  }
  return null
}

export function detectPurchaseEvents(
  params: EventDetectionParams,
): InferenceEvent[] {
  const { productId, confidence, behaviorType } = params
  const sorted = [...params.purchases].sort(
    (a, b) => a.date.getTime() - b.date.getTime(),
  )
  const events: InferenceEvent[] = []

  for (let index = 0; index < sorted.length; index += 1) {
    const current = sorted[index]
    const prior = sorted.slice(0, index)
    let detected = false

    if (prior.length > 0) {
      const previous = prior[prior.length - 1]
      const intervalDays = daysBetween(current.date, previous.date)
      const priorConsumption = computeConsumption(
        prior.map((purchase) => ({ date: purchase.date, quantity: purchase.quantity })),
      )
      const expectedInterval = priorConsumption.averageRefillInterval

      if (
        expectedInterval !== null &&
        expectedInterval > 0 &&
        intervalDays < expectedInterval * EARLY_RATIO
      ) {
        events.push(
          buildEvent('compra_antecipada', {
            productId,
            purchaseId: current.id,
            date: current.date,
            title: 'Possível compra antecipada',
            description: `A reposição ocorreu ${Math.round(intervalDays)} dias após a anterior; o padrão estimado era de cerca de ${Math.round(expectedInterval)} dias.`,
            impact: 'Estoque aumentado; consumo médio preservado.',
            confidence,
            details: {
              intervalDays: Math.round(intervalDays),
              expectedIntervalDays: Math.round(expectedInterval),
            },
          }),
        )
        detected = true
      }

      if (
        expectedInterval !== null &&
        expectedInterval > 0 &&
        intervalDays > expectedInterval * LATE_RATIO
      ) {
        events.push(
          buildEvent('compra_tardia', {
            productId,
            purchaseId: current.id,
            date: current.date,
            title: 'Possível compra tardia',
            description: `A reposição ocorreu ${Math.round(intervalDays)} dias após a anterior, acima do intervalo habitual estimado.`,
            impact: 'O intervalo maior é sinalizado, sem ser tratado como consumo adicional.',
            confidence,
            details: {
              intervalDays: Math.round(intervalDays),
              expectedIntervalDays: Math.round(expectedInterval),
            },
          }),
        )
        detected = true
      }

      if (priorConsumption.dailyAverage && priorConsumption.dailyAverage > 0) {
        const stockBefore = reconstructStock({
          purchases: prior.map((purchase) => ({
            date: purchase.date,
            quantity: purchase.quantity,
          })),
          dailyConsumption: priorConsumption.dailyAverage,
          unit: '',
          asOf: current.date,
        })
        if (stockBefore < 0) {
          const shortageDays = Math.abs(stockBefore) / priorConsumption.dailyAverage
          if (shortageDays >= SHORTAGE_MIN_DAYS) {
            events.push(
              buildEvent('possivel_periodo_sem_produto', {
                productId,
                purchaseId: current.id,
                date: current.date,
                title: 'Possível período sem produto',
                description: `O estoque estimado pode ter ficado insuficiente por cerca de ${Math.round(shortageDays)} dia(s) antes desta reposição.`,
                impact: 'A lacuna não é contabilizada como consumo normal.',
                confidence,
                details: { shortageDays: Math.round(shortageDays) },
              }),
            )
            detected = true
          }
        }
      }

      const priorMedianQuantity = median(prior.map((purchase) => purchase.quantity))
      if (
        prior.length >= 2 &&
        priorMedianQuantity !== null &&
        priorMedianQuantity > 0 &&
        current.quantity >= priorMedianQuantity * BULK_MEDIAN_MULTIPLE
      ) {
        events.push(
          buildEvent('compra_grande_volume', {
            productId,
            purchaseId: current.id,
            date: current.date,
            title: 'Compra em grande volume',
            description: `A quantidade foi maior que o padrão recente de reposição (${current.quantity} versus mediana de ${priorMedianQuantity}).`,
            impact: 'Estoque aumentado; nenhuma alta de consumo é concluída apenas por esta compra.',
            confidence,
            details: { quantity: current.quantity, medianQuantity: priorMedianQuantity },
          }),
        )
        detected = true
      }
    }

    const contextual = contextualEvent(behaviorType, productId, current, confidence)
    if (contextual) {
      events.push(contextual)
      detected = true
    }

    if (!detected) {
      events.push(
        buildEvent('compra_normal', {
          productId,
          purchaseId: current.id,
          date: current.date,
          title: index === 0 ? 'Primeira compra registrada' : 'Compra dentro do padrão',
          description:
            index === 0
              ? 'Ainda não há ciclos suficientes para comparar esta compra.'
              : 'Não foram detectadas variações relevantes nesta reposição.',
          impact: 'A compra foi somada ao estoque estimado.',
          confidence: index === 0 ? 'muito_baixa' : confidence,
        }),
      )
    }
  }

  return events
}

export function detectTrendEvents(
  productId: string,
  consumption: ConsumptionMetrics,
  confidence: ConfidenceLevel,
  referenceDate: Date,
): InferenceEvent[] {
  if (consumption.trend === 'aumentando') {
    return [
      buildEvent('consumo_aumentando', {
        productId,
        purchaseId: null,
        date: referenceDate,
        title: 'Consumo estimado em alta',
        description: 'As taxas estimadas entre ciclos recentes apresentam tendência de aumento.',
        impact: 'A previsão de estoque passa a considerar um ritmo de uso maior.',
        confidence,
      }),
    ]
  }
  if (consumption.trend === 'diminuindo') {
    return [
      buildEvent('consumo_diminuindo', {
        productId,
        purchaseId: null,
        date: referenceDate,
        title: 'Consumo estimado em queda',
        description: 'As taxas estimadas entre ciclos recentes apresentam tendência de redução.',
        impact: 'A previsão de estoque passa a considerar um ritmo de uso menor.',
        confidence,
      }),
    ]
  }
  return []
}
