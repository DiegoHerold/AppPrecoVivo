/** Reconstrói e registra todos os eventos derivados de um usuário. */

import 'server-only'

import { inferProduct } from '../engine'
import { replaceInferenceEventsForUser } from '../repositories/inference-events.repository'
import { loadProductInputs } from '../repositories/products.repository'
import { loadPurchasesByProduct } from '../repositories/purchases.repository'

export async function syncInferenceEventsForUser(
  userId: string,
  asOf: Date = new Date(),
) {
  const [products, purchasesByProduct] = await Promise.all([
    loadProductInputs(userId),
    loadPurchasesByProduct(userId),
  ])
  const events = products.flatMap((product) =>
    inferProduct({
      product,
      purchases: purchasesByProduct.get(product.id) ?? [],
      asOf,
    }).events,
  )
  await replaceInferenceEventsForUser(userId, events)
  return events.length
}
