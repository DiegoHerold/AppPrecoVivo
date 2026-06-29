import type { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { recalculatePurchaseMonth } from '@/lib/monthly-flow'
import { getProductDetail } from '@/lib/queries'
import type { productUpdateSchema } from '@/lib/validation'

type ProductUpdateInput = z.infer<typeof productUpdateSchema>

export class ProductUpdateError extends Error {
  constructor(message: string, public status = 400) {
    super(message)
    this.name = 'ProductUpdateError'
  }
}

export async function updateProduct(userId: string, productId: string, input: ProductUpdateInput) {
  const [product, category, duplicate] = await Promise.all([
    prisma.product.findFirst({
      where: { id: productId, userId, active: true },
      include: { account: true, items: { include: { purchase: { select: { purchaseDate: true } } } } },
    }),
    prisma.category.findFirst({ where: { id: input.categoryId, userId, active: true } }),
    prisma.product.findFirst({
      where: { userId, id: { not: productId }, standardName: { equals: input.standardName, mode: 'insensitive' } },
      select: { id: true },
    }),
  ])

  if (!product) throw new ProductUpdateError('Produto não encontrado.', 404)
  if (!product.account) throw new ProductUpdateError('Produto sem conta correspondente no plano de contas.', 409)
  const productAccount = product.account
  if (!category) throw new ProductUpdateError('Classificação não encontrada ou desativada.', 404)
  if (duplicate) throw new ProductUpdateError('Já existe outro produto com esse nome.', 409)
  if (!category.allowedUnits.includes(input.defaultUnit)) {
    throw new ProductUpdateError('A unidade escolhida não está habilitada nessa classificação.')
  }

  await prisma.$transaction(async (tx) => {
    await tx.product.update({
      where: { id: productId },
      data: {
        standardName: input.standardName,
        brand: input.brand || null,
        categoryId: input.categoryId,
        behaviorType: input.behaviorType,
        estimatedDurationMonths: input.estimatedDurationMonths,
        defaultUnit: input.defaultUnit,
        packageSize: input.packageSize || null,
        classificationConfirmed: true,
      },
    })
    await tx.productAccount.update({
      where: { productId },
      data: {
        name: input.standardName,
        categoryId: input.categoryId,
        active: true,
      },
    })
    if (input.applyToHistory) {
      await tx.purchaseItem.updateMany({
        where: { productId, purchase: { userId } },
        data: {
          productAccountId: productAccount.id,
          categoryId: input.categoryId,
          behaviorType: input.behaviorType,
          estimatedDurationMonths: input.estimatedDurationMonths,
          matchConfidence: 1,
          needsReview: false,
        },
      })
    }
  })

  if (input.applyToHistory) {
    const months = new Map<string, Date>()
    for (const item of product.items) {
      const date = item.purchase.purchaseDate
      months.set(String(date.getUTCFullYear()) + '-' + String(date.getUTCMonth() + 1), date)
    }
    for (const date of months.values()) await recalculatePurchaseMonth(userId, date)
  }

  return getProductDetail(userId, productId)
}

export async function deactivateProduct(userId: string, productId: string) {
  const product = await prisma.product.findFirst({
    where: { id: productId, userId, active: true },
    include: { account: true },
  })
  if (!product) throw new ProductUpdateError('Produto não encontrado.', 404)
  if (!product.account) throw new ProductUpdateError('Produto sem conta correspondente no plano de contas.', 409)

  await prisma.$transaction(async (tx) => {
    await tx.product.update({ where: { id: productId }, data: { active: false } })
    await tx.productAccount.update({ where: { productId }, data: { active: false } })
  })

  return { id: productId, active: false, accountId: product.account.id, accountActive: false }
}
