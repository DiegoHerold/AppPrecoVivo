import type { BehaviorType, Prisma } from '@/generated/prisma/client'

export type NewProductInput = {
  standardName: string
  categoryId: string
  behaviorType: BehaviorType
  estimatedDurationMonths: number
  defaultUnit: string
  classificationConfirmed: boolean
  active?: boolean
  brand?: string | null
  packageSize?: string | null
}

export async function createProductWithAccount(tx: Prisma.TransactionClient, userId: string, input: NewProductInput) {
  const product = await tx.product.create({
    data: {
      userId,
      standardName: input.standardName,
      categoryId: input.categoryId,
      behaviorType: input.behaviorType,
      estimatedDurationMonths: input.estimatedDurationMonths,
      defaultUnit: input.defaultUnit,
      classificationConfirmed: input.classificationConfirmed,
      active: input.active ?? true,
      brand: input.brand || null,
      packageSize: input.packageSize || null,
    },
  })
  const account = await tx.productAccount.create({
    data: {
      userId,
      productId: product.id,
      name: product.standardName,
      type: 'PRODUTO',
      categoryId: product.categoryId,
      active: product.active,
    },
  })
  return { product, account }
}
