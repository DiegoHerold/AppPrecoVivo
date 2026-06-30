import type { BehaviorType, Prisma } from '@/generated/prisma/client'
import { classificationSimilarity, normalizeProductName, suggestLearnedCategory, textSimilarity } from '@/lib/domain'

export type ProductMatchCandidate = {
  id: string
  standardName: string
  behaviorType: BehaviorType
  estimatedDurationMonths: Prisma.Decimal | number
  classificationConfirmed: boolean
  node: { id: string; parentId: string | null } | null
  aliases: { aliasName: string; normalizedAliasName: string }[]
}

export function matchProductByAlias(products: readonly ProductMatchCandidate[], rawName: string) {
  const normalized = normalizeProductName(rawName)
  const exact = products.find((product) => (
    normalizeProductName(product.standardName) === normalized
    || product.aliases.some((alias) => alias.normalizedAliasName === normalized)
  ))
  if (exact) {
    if (!exact.node) throw new Error('Produto sem nó correspondente no plano de contas.')
    return { product: exact, node: exact.node, confidence: 0.99 }
  }

  let best: ProductMatchCandidate | null = null
  let confidence = 0
  for (const product of products) {
    const candidates = [product.standardName, ...product.aliases.map((alias) => alias.aliasName)]
    const score = Math.max(...candidates.map((candidate) => {
      const textual = textSimilarity(candidate, rawName)
      return Math.max(textual, textual * 0.72 + classificationSimilarity(candidate, rawName) * 0.28)
    }))
    if (score > confidence) { best = product; confidence = score }
  }
  if (!best || confidence < 0.78) return null
  if (!best.node) throw new Error('Produto sem nó correspondente no plano de contas.')
  return { product: best, node: best.node, confidence }
}

export function learnedGroupFor(products: readonly ProductMatchCandidate[], rawName: string) {
  const learned = suggestLearnedCategory(rawName, products.flatMap((product) => (
    product.classificationConfirmed && product.node?.parentId
      ? [{ categoryId: product.node.parentId, names: [product.standardName, ...product.aliases.map((alias) => alias.aliasName)] }]
      : []
  )))
  if (!learned) return null
  return { groupId: learned.categoryId, confidence: Math.min(0.94, Math.round((0.68 + learned.score * 0.28) * 100) / 100) }
}
