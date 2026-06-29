/**
 * Repositório de compras (reposições). Lê PurchaseItem + Purchase do Prisma e
 * mapeia para `PurchaseRecord`, convertendo a quantidade para a unidade padrão
 * do produto quando possível (ver value-object Quantity).
 *
 * O histórico original NUNCA é alterado aqui — apenas lido. A conversão de
 * unidade acontece em memória, na leitura, e marca `unitConverted: false`
 * quando não foi segura, para o motor degradar a confiança a montante.
 */

import 'server-only'

import type { PurchaseRecord } from '../domain/entities'
import { toStandardUnit } from '../domain/value-objects/quantity'
import { prisma } from '../lib/prisma'

const toNumber = (value: unknown) => Number(value ?? 0)

/** Mapa productId -> unidade padrão, para conversão de quantidades. */
async function standardUnits(userId: string): Promise<Map<string, string>> {
  const products = await prisma.product.findMany({
    where: { userId, active: true },
    select: { id: true, defaultUnit: true },
  })
  return new Map(products.map((p) => [p.id, p.defaultUnit]))
}

function mapItem(
  item: {
    id: string
    productId: string
    quantity: unknown
    unit: string
    unitPrice: unknown
    totalPrice: unknown
    purchase: {
      id: string
      purchaseDate: Date
      storeId: string | null
      store: { name: string } | null
    }
    planoConta?: { parent: { nome: string } | null } | null
  },
  standardUnit: string,
): PurchaseRecord {
  const converted = toStandardUnit(
    { amount: toNumber(item.quantity), unit: item.unit },
    standardUnit,
  )
  return {
    id: item.id,
    purchaseId: item.purchase.id,
    productId: item.productId,
    date: item.purchase.purchaseDate,
    quantity: converted.amount,
    unit: converted.unit,
    unitConverted: converted.converted,
    unitPrice: toNumber(item.unitPrice),
    totalPrice: toNumber(item.totalPrice),
    storeId: item.purchase.storeId,
    storeName: item.purchase.store?.name ?? null,
    category: item.planoConta?.parent?.nome ?? null,
    origin: 'importacao',
    notes: null,
  }
}

/** Compras de um único produto, em ordem cronológica. */
export async function loadPurchasesForProduct(
  userId: string,
  productId: string,
): Promise<PurchaseRecord[]> {
  const product = await prisma.product.findFirst({
    where: { id: productId, userId, active: true },
    select: { defaultUnit: true },
  })
  if (!product) return []

  const items = await prisma.purchaseItem.findMany({
    where: { productId, purchase: { userId } },
    include: {
      purchase: { include: { store: { select: { name: true } } } },
      planoConta: { include: { parent: { select: { nome: true } } } },
    },
    orderBy: { purchase: { purchaseDate: 'asc' } },
  })

  return items.map((item) => mapItem(item, product.defaultUnit))
}

/** Compras de TODOS os produtos do usuário, agrupadas por productId. */
export async function loadPurchasesByProduct(
  userId: string,
): Promise<Map<string, PurchaseRecord[]>> {
  const units = await standardUnits(userId)
  const items = await prisma.purchaseItem.findMany({
    where: { purchase: { userId } },
    include: {
      purchase: { include: { store: { select: { name: true } } } },
      planoConta: { include: { parent: { select: { nome: true } } } },
    },
    orderBy: { purchase: { purchaseDate: 'asc' } },
  })

  const grouped = new Map<string, PurchaseRecord[]>()
  for (const item of items) {
    const standardUnit = units.get(item.productId) ?? item.unit
    const record = mapItem(item, standardUnit)
    const arr = grouped.get(item.productId) ?? []
    arr.push(record)
    grouped.set(item.productId, arr)
  }
  return grouped
}
