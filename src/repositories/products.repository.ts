/**
 * Repositório de produtos. Lê do Prisma e mapeia para `ProductInput` puro.
 *
 * Não contém regra de negócio (isso vive em engine/). Apenas tradução entre a
 * persistência e o domínio. Usa dados REAIS — sem mocks fixos.
 */

import 'server-only'

import type { ProductInput } from '../domain/entities'
import { normalizeProductName } from '../lib/domain'
import { prisma } from '../lib/prisma'

export async function loadProductInputs(userId: string): Promise<ProductInput[]> {
  const products = await prisma.product.findMany({
    where: { userId, active: true },
    include: { node: { include: { parent: true } } },
  })

  return products.map((product) => ({
    id: product.id,
    name: product.standardName,
    normalizedName: normalizeProductName(product.standardName),
    category: product.node?.parent?.nome ?? null,
    standardUnit: product.defaultUnit,
    behaviorType: product.behaviorType,
  }))
}

export async function loadProductInput(
  userId: string,
  productId: string,
): Promise<ProductInput | null> {
  const product = await prisma.product.findFirst({
    where: { id: productId, userId, active: true },
    include: { node: { include: { parent: true } } },
  })
  if (!product) return null
  return {
    id: product.id,
    name: product.standardName,
    normalizedName: normalizeProductName(product.standardName),
    category: product.node?.parent?.nome ?? null,
    standardUnit: product.defaultUnit,
    behaviorType: product.behaviorType,
  }
}
