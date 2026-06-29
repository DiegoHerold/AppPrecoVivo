import { prisma } from '@/lib/prisma'
import { calculateEstimatedConsumption } from '@/lib/domain'
import { loadFlowItems, monthRange, recalculateMonthlyFlow } from '@/lib/monthly-flow'

const toNumber = (value: unknown) => Number(value ?? 0)
const round = (value: number) => Math.round(value * 100) / 100

function monthName(year: number, month: number) {
  return new Intl.DateTimeFormat('pt-BR', { month: 'long', timeZone: 'UTC' })
    .format(new Date(Date.UTC(year, month - 1, 1)))
    .replace(/^./, (letter) => letter.toUpperCase())
}

function priorMonth(year: number, month: number) {
  const date = new Date(Date.UTC(year, month - 2, 1))
  return { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1 }
}

export async function getDashboard(userId: string, year: number, month: number) {
  const previous = priorMonth(year, month)
  const calculation = await recalculateMonthlyFlow(userId, year, month)
  const [flow, previousFlow, insights, currentItems, previousItems, categoryRows] = await Promise.all([
    prisma.monthlyFlow.findUnique({ where: { userId_month_year: { userId, year, month } } }),
    prisma.monthlyFlow.findUnique({ where: { userId_month_year: { userId, year: previous.year, month: previous.month } } }),
    prisma.monthlyInsight.findMany({ where: { userId, year, month }, orderBy: { amount: 'desc' } }),
    loadFlowItems(userId, year, month),
    loadFlowItems(userId, previous.year, previous.month),
    prisma.category.findMany({ where: { userId, active: true }, orderBy: { createdAt: 'asc' } }),
  ])

  const categoryTotals = new Map<string, { total: number; consumption: number; stock: number }>()
  const previousCategoryTotals = new Map<string, number>()
  for (const item of currentItems) {
    if (!item.categoryId) continue
    const value = categoryTotals.get(item.categoryId) ?? { total: 0, consumption: 0, stock: 0 }
    const consumption = calculateEstimatedConsumption(item)
    value.total += item.totalPrice
    value.consumption += consumption
    value.stock += item.totalPrice - consumption
    categoryTotals.set(item.categoryId, value)
  }
  for (const item of previousItems) {
    if (item.categoryId) previousCategoryTotals.set(item.categoryId, (previousCategoryTotals.get(item.categoryId) ?? 0) + item.totalPrice)
  }

  const categories = categoryRows.map((category) => {
    const value = categoryTotals.get(category.id) ?? { total: 0, consumption: 0, stock: 0 }
    return {
      id: category.id,
      name: category.name,
      icon: category.icon,
      color: category.color,
      totalSpent: round(value.total),
      estimatedConsumption: round(value.consumption),
      stockAmount: round(value.stock),
      variation: round(value.total - (previousCategoryTotals.get(category.id) ?? 0)),
    }
  }).sort((a, b) => b.totalSpent - a.totalSpent)

  const history = []
  for (let offset = 5; offset >= 0; offset -= 1) {
    const date = new Date(Date.UTC(year, month - 1 - offset, 1))
    const row = await prisma.monthlyFlow.findUnique({
      where: { userId_month_year: { userId, year: date.getUTCFullYear(), month: date.getUTCMonth() + 1 } },
    })
    history.push({
      label: monthName(date.getUTCFullYear(), date.getUTCMonth() + 1).slice(0, 3),
      month: date.getUTCMonth() + 1,
      year: date.getUTCFullYear(),
      totalSpent: toNumber(row?.totalSpent),
      estimatedConsumption: toNumber(row?.estimatedConsumption),
    })
  }

  const totalSpent = toNumber(flow?.totalSpent)
  const previousTotalSpent = toNumber(previousFlow?.totalSpent)
  return {
    year,
    month,
    monthLabel: monthName(year, month),
    previousMonthLabel: monthName(previous.year, previous.month),
    totalSpent,
    previousTotalSpent,
    difference: round(totalSpent - previousTotalSpent),
    estimatedConsumption: toNumber(flow?.estimatedConsumption),
    stockAmount: toNumber(flow?.stockAmount),
    recurringAmount: toNumber(flow?.recurringAmount),
    punctualAmount: toNumber(flow?.punctualAmount),
    priceIncreaseAmount: toNumber(flow?.priceIncreaseAmount),
    quantityIncreaseAmount: toNumber(flow?.quantityIncreaseAmount),
    purchaseCount: await prisma.purchase.count({
      where: { userId, purchaseDate: { gte: monthRange(year, month).start, lt: monthRange(year, month).end }, importStatus: 'importacao_manual' },
    }),
    categories,
    history,
    insights: insights.map((insight) => ({
      id: insight.id,
      type: insight.type,
      title: insight.title,
      description: insight.description,
      amount: toNumber(insight.amount),
    })),
    outOfPattern: calculation.outOfPattern.map((item) => ({ name: item.name, amount: item.totalPrice, behaviorType: item.behaviorType })),
  }
}

export async function listCategories(userId: string, year: number, month: number) {
  return (await getDashboard(userId, year, month)).categories
}

export async function listProducts(userId: string) {
  const products = await prisma.product.findMany({
    where: { userId, active: true },
    include: {
      category: { select: { name: true, icon: true, color: true } },
      items: { include: { purchase: { select: { purchaseDate: true } } } },
    },
    orderBy: { updatedAt: 'desc' },
  })
  return products.map((product) => {
    const history = product.items.sort((a, b) => b.purchase.purchaseDate.getTime() - a.purchase.purchaseDate.getTime())
    return {
      id: product.id,
      standardName: product.standardName,
      brand: product.brand,
      behaviorType: product.behaviorType,
      estimatedDurationMonths: toNumber(product.estimatedDurationMonths),
      defaultUnit: product.defaultUnit,
      packageSize: product.packageSize,
      categoryName: product.category.name,
      categoryIcon: product.category.icon,
      categoryColor: product.category.color,
      lastPrice: toNumber(history[0]?.unitPrice),
      lastPurchaseDate: history[0]?.purchase.purchaseDate.toISOString() ?? null,
      purchaseCount: new Set(history.map((item) => item.purchaseId)).size,
    }
  })
}

export async function getProductDetail(userId: string, productId: string) {
  const product = await prisma.product.findFirst({
    where: { id: productId, userId, active: true },
    include: {
      category: true,
      items: { include: { purchase: { include: { store: true } } } },
    },
  })
  if (!product) return null
  const history = product.items.sort((a, b) => b.purchase.purchaseDate.getTime() - a.purchase.purchaseDate.getTime())
  const prices = history.map((item) => toNumber(item.unitPrice))
  const averagePrice = prices.length ? prices.reduce((sum, price) => sum + price, 0) / prices.length : 0
  const averageQuantity = history.length ? history.reduce((sum, item) => sum + toNumber(item.quantity), 0) / history.length : 0
  const intervals = history.slice(0, -1).map((item, index) => Math.abs(item.purchase.purchaseDate.getTime() - history[index + 1].purchase.purchaseDate.getTime()) / 86_400_000)
  return {
    id: product.id,
    standardName: product.standardName,
    brand: product.brand,
    behaviorType: product.behaviorType,
    estimatedDurationMonths: toNumber(product.estimatedDurationMonths),
    defaultUnit: product.defaultUnit,
    packageSize: product.packageSize,
    categoryName: product.category.name,
    categoryIcon: product.category.icon,
    categoryColor: product.category.color,
    categoryId: product.categoryId,
    allowedUnits: product.category.allowedUnits,
    lastPrice: prices[0] ?? 0,
    minimumPrice: prices.length ? Math.min(...prices) : 0,
    maximumPrice: prices.length ? Math.max(...prices) : 0,
    averagePrice: round(averagePrice),
    averageQuantity: round(averageQuantity),
    frequencyDays: intervals.length ? Math.round(intervals.reduce((sum, value) => sum + value, 0) / intervals.length) : null,
    monthlyCost: round((prices[0] ?? averagePrice) / Math.max(1, toNumber(product.estimatedDurationMonths))),
    history: history.map((item) => ({
      id: item.id,
      purchaseDate: item.purchase.purchaseDate.toISOString(),
      storeName: item.purchase.store?.name ?? 'Estabelecimento não informado',
      quantity: toNumber(item.quantity),
      unit: item.unit,
      unitPrice: toNumber(item.unitPrice),
      totalPrice: toNumber(item.totalPrice),
    })),
  }
}

export async function listReviews(userId: string) {
  const items = await prisma.purchaseItem.findMany({
    where: { needsReview: true, purchase: { userId } },
    include: { product: true, category: true, purchase: { select: { purchaseDate: true } } },
    orderBy: { createdAt: 'asc' },
  })
  return items.map((item) => ({
    id: item.id,
    rawName: item.rawName,
    productId: item.productId,
    productName: item.product?.standardName ?? item.rawName,
    categoryId: item.categoryId,
    categoryName: item.category.name,
    behaviorType: item.behaviorType,
    estimatedDurationMonths: toNumber(item.estimatedDurationMonths),
    matchConfidence: toNumber(item.matchConfidence),
    quantity: toNumber(item.quantity),
    unit: item.unit,
    unitPrice: toNumber(item.unitPrice),
    totalPrice: toNumber(item.totalPrice),
    purchaseDate: item.purchase.purchaseDate.toISOString(),
  }))
}

export async function getPurchaseSummary(userId: string, purchaseId: string) {
  const purchase = await prisma.purchase.findFirst({
    where: { id: purchaseId, userId },
    include: { store: true, items: { include: { product: true, category: true } }, importJobs: true },
  })
  if (!purchase) return null
  const items = purchase.items.map((item) => ({
    id: item.id,
    rawName: item.rawName,
    productName: item.product?.standardName ?? item.rawName,
    categoryName: item.category.name,
    behaviorType: item.behaviorType,
    estimatedDurationMonths: toNumber(item.estimatedDurationMonths),
    quantity: toNumber(item.quantity),
    unit: item.unit,
    unitPrice: toNumber(item.unitPrice),
    totalPrice: toNumber(item.totalPrice),
    needsReview: item.needsReview,
  }))
  const estimatedConsumption = items.reduce((sum, item) => sum + calculateEstimatedConsumption({
    totalPrice: item.totalPrice,
    behaviorType: item.behaviorType,
    estimatedDurationMonths: item.estimatedDurationMonths,
  }), 0)
  return {
    id: purchase.id,
    storeName: purchase.store?.name ?? 'Importação pendente',
    storeType: purchase.store?.type ?? 'outro',
    purchaseDate: purchase.purchaseDate.toISOString(),
    totalAmount: toNumber(purchase.totalAmount),
    importStatus: purchase.importStatus,
    reviewStatus: purchase.reviewStatus,
    estimatedConsumption: round(estimatedConsumption),
    stockAmount: round(toNumber(purchase.totalAmount) - estimatedConsumption),
    items,
    job: purchase.importJobs[0] ? {
      status: purchase.importJobs[0].status,
      message: purchase.importJobs[0].errorMessage,
    } : null,
  }
}
