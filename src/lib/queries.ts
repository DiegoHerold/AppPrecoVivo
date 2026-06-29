import { prisma } from '@/lib/prisma'
import { calculateEstimatedConsumption } from '@/lib/domain'

const toNumber = (value: unknown) => Number(value ?? 0)
const round = (value: number) => Math.round(value * 100) / 100

const FALLBACK_GROUP = { id: '', nome: 'Sem grupo', icone: '📦', cor: '#9CA3AF', allowedUnits: ['un'] as string[] }

export async function listProducts(userId: string) {
  const products = await prisma.product.findMany({
    where: { userId, active: true },
    include: {
      node: { include: { parent: true } },
      items: { include: { purchase: { select: { purchaseDate: true } } } },
    },
    orderBy: { updatedAt: 'desc' },
  })
  return products.map((product) => {
    if (!product.node) throw new Error('Produto sem nó correspondente no plano de contas.')
    const group = product.node.parent ?? FALLBACK_GROUP
    const history = product.items.sort((a, b) => b.purchase.purchaseDate.getTime() - a.purchase.purchaseDate.getTime())
    return {
      id: product.id,
      accountPlanId: product.node.id,
      accountName: product.node.nome,
      accountActive: product.node.ativo,
      standardName: product.standardName,
      brand: product.brand,
      behaviorType: product.behaviorType,
      estimatedDurationMonths: toNumber(product.estimatedDurationMonths),
      defaultUnit: product.defaultUnit,
      packageSize: product.packageSize,
      categoryName: group.nome,
      categoryIcon: group.icone,
      categoryColor: group.cor,
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
      node: { include: { parent: true } },
      items: { include: { purchase: { include: { store: true } } } },
    },
  })
  if (!product) return null
  if (!product.node) throw new Error('Produto sem nó correspondente no plano de contas.')
  const group = product.node.parent ?? FALLBACK_GROUP
  const history = product.items.sort((a, b) => b.purchase.purchaseDate.getTime() - a.purchase.purchaseDate.getTime())
  const prices = history.map((item) => toNumber(item.unitPrice))
  const averagePrice = prices.length ? prices.reduce((sum, price) => sum + price, 0) / prices.length : 0
  const averageQuantity = history.length ? history.reduce((sum, item) => sum + toNumber(item.quantity), 0) / history.length : 0
  const intervals = history.slice(0, -1).map((item, index) => Math.abs(item.purchase.purchaseDate.getTime() - history[index + 1].purchase.purchaseDate.getTime()) / 86_400_000)
  return {
    id: product.id,
    accountPlanId: product.node.id,
    accountName: product.node.nome,
    accountActive: product.node.ativo,
    standardName: product.standardName,
    brand: product.brand,
    behaviorType: product.behaviorType,
    estimatedDurationMonths: toNumber(product.estimatedDurationMonths),
    defaultUnit: product.defaultUnit,
    packageSize: product.packageSize,
    categoryName: group.nome,
    categoryIcon: group.icone,
    categoryColor: group.cor,
    categoryId: group.id,
    allowedUnits: group.allowedUnits,
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
    include: {
      product: true,
      planoConta: { include: { parent: true } },
      purchase: { select: { purchaseDate: true } },
    },
    orderBy: { createdAt: 'asc' },
  })
  return items.map((item) => {
    const group = item.planoConta.parent ?? FALLBACK_GROUP
    return {
      id: item.id,
      rawName: item.rawName,
      productId: item.productId,
      productName: item.product.standardName ?? item.rawName,
      categoryId: group.id,
      categoryName: group.nome,
      // A revisão começa sempre com a recorrência atual do produto. O valor
      // histórico do item pode estar desatualizado após uma edição posterior.
      behaviorType: item.product.behaviorType,
      estimatedDurationMonths: toNumber(item.product.estimatedDurationMonths),
      matchConfidence: toNumber(item.matchConfidence),
      quantity: toNumber(item.quantity),
      unit: item.unit,
      unitPrice: toNumber(item.unitPrice),
      totalPrice: toNumber(item.totalPrice),
      purchaseDate: item.purchase.purchaseDate.toISOString(),
    }
  })
}

export async function getPurchaseSummary(userId: string, purchaseId: string) {
  const purchase = await prisma.purchase.findFirst({
    where: { id: purchaseId, userId },
    include: {
      store: true,
      items: { include: { product: true, planoConta: { include: { parent: true } } } },
      importJobs: true,
    },
  })
  if (!purchase) return null
  const items = purchase.items.map((item) => ({
    id: item.id,
    rawName: item.rawName,
    productName: item.product.standardName ?? item.rawName,
    categoryName: item.planoConta.parent?.nome ?? FALLBACK_GROUP.nome,
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
