import type { BehaviorType, InsightType } from '@/generated/prisma/client'
import { prisma } from '@/lib/prisma'
import {
  calculateMonthlyFlow,
  detectOutOfPatternProducts,
  explainMonthlyDifference,
  type FlowItem,
} from '@/lib/domain'

const number = (value: unknown) => Number(value ?? 0)
const round = (value: number) => Math.round(value * 100) / 100

export function monthRange(year: number, month: number) {
  return {
    start: new Date(Date.UTC(year, month - 1, 1)),
    end: new Date(Date.UTC(year, month, 1)),
  }
}

function previousMonth(year: number, month: number) {
  const date = new Date(Date.UTC(year, month - 2, 1))
  return { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1 }
}

export async function loadFlowItems(userId: string, year: number, month: number): Promise<FlowItem[]> {
  const range = monthRange(year, month)
  const rows = await prisma.purchaseItem.findMany({
    where: {
      purchase: { userId, purchaseDate: { gte: range.start, lt: range.end } },
    },
    include: {
      product: { select: { standardName: true } },
      planoConta: { select: { id: true, nome: true, parentId: true } },
    },
  })

  return rows.map((item) => ({
    key: item.planoContaId,
    name: item.planoConta.nome ?? item.product.standardName ?? item.rawName,
    purchaseId: item.purchaseId,
    quantity: number(item.quantity),
    unit: item.unit,
    unitPrice: number(item.unitPrice),
    totalPrice: number(item.totalPrice),
    behaviorType: item.behaviorType,
    estimatedDurationMonths: number(item.estimatedDurationMonths),
    nodeId: item.planoContaId,
    groupId: item.planoConta.parentId,
  }))
}

export async function recalculateMonthlyFlow(userId: string, year: number, month: number) {
  const previous = previousMonth(year, month)
  const [currentItems, previousItems] = await Promise.all([
    loadFlowItems(userId, year, month),
    loadFlowItems(userId, previous.year, previous.month),
  ])
  const flow = calculateMonthlyFlow(currentItems, previousItems)
  const insights = explainMonthlyDifference(currentItems, previousItems).filter((item) => item.amount > 0.009)
  const outOfPattern = detectOutOfPatternProducts(currentItems, previousItems)

  await prisma.$transaction(async (tx) => {
    await tx.monthlyFlow.upsert({
      where: { userId_month_year: { userId, month, year } },
      update: {
        totalSpent: round(flow.totalSpent),
        estimatedConsumption: round(flow.estimatedConsumption),
        stockAmount: round(flow.stockAmount),
        recurringAmount: round(flow.recurringAmount),
        punctualAmount: round(flow.punctualAmount),
        priceIncreaseAmount: round(flow.priceIncreaseAmount),
        quantityIncreaseAmount: round(flow.quantityIncreaseAmount),
      },
      create: {
        userId,
        month,
        year,
        totalSpent: round(flow.totalSpent),
        estimatedConsumption: round(flow.estimatedConsumption),
        stockAmount: round(flow.stockAmount),
        recurringAmount: round(flow.recurringAmount),
        punctualAmount: round(flow.punctualAmount),
        priceIncreaseAmount: round(flow.priceIncreaseAmount),
        quantityIncreaseAmount: round(flow.quantityIncreaseAmount),
      },
    })
    await tx.monthlyInsight.deleteMany({ where: { userId, month, year } })
    if (insights.length) {
      await tx.monthlyInsight.createMany({
        data: insights.map((insight) => ({
          userId,
          month,
          year,
          type: insight.type as InsightType,
          title: insight.title,
          description: insight.description,
          amount: round(insight.amount),
        })),
      })
    }
    if (outOfPattern.length) {
      await tx.monthlyInsight.create({
        data: {
          userId,
          month,
          year,
          type: 'fora_do_padrao',
          title: 'Produtos fora do padrão',
          description: `${outOfPattern.length} ${outOfPattern.length === 1 ? 'produto saiu' : 'produtos saíram'} do seu padrão neste mês.`,
          amount: round(outOfPattern.reduce((sum, item) => sum + item.totalPrice, 0)),
        },
      })
    }
  })

  return { ...flow, insights, outOfPattern }
}

export async function recalculatePurchaseMonth(userId: string, purchaseDate: Date) {
  const year = purchaseDate.getUTCFullYear()
  const month = purchaseDate.getUTCMonth() + 1
  await recalculateMonthlyFlow(userId, year, month)
  const next = new Date(Date.UTC(year, month, 1))
  await recalculateMonthlyFlow(userId, next.getUTCFullYear(), next.getUTCMonth() + 1)
}

export function behaviorLabel(behavior: BehaviorType) {
  return ({
    recorrente_semanal: 'Recorrente semanal',
    recorrente_mensal: 'Recorrente mensal',
    estoque: 'Estoque',
    pontual: 'Pontual',
    sazonal: 'Sazonal',
    emergencia: 'Emergência',
    fora_do_padrao: 'Fora do padrão',
  } satisfies Record<BehaviorType, string>)[behavior]
}
