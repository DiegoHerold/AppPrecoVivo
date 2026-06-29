/**
 * Serviço de importação de notas (adaptador).
 *
 * A importação de NFC-e / texto já existe em lib/importers + lib/purchases.
 * Este módulo documenta o ponto de integração com o motor: SEMPRE que uma nota
 * é importada, a quantidade comprada deve ser SOMADA ao estoque estimado.
 *
 * No modelo atual, o estoque é reconstruído sob demanda a partir do histórico
 * imutável de compras (ver engine/inventory). Portanto "somar ao estoque" é
 * uma consequência automática de persistir a compra — não há estado mutável a
 * atualizar e o histórico nunca é sobrescrito. Quando/se um cache de estoque
 * for introduzido, é aqui que o gatilho de recálculo deve ser disparado.
 */

import 'server-only'

import { buildProductDashboard } from './report.service'

/**
 * Gatilho pós-importação: recalcula a inferência do produto afetado.
 * Hoje apenas reconstrói (idempotente); pronto para, no futuro, popular cache.
 */
export async function onPurchaseImported(
  userId: string,
  productId: string,
  asOf: Date = new Date(),
) {
  // Recalcula a visão do produto a partir do histórico atualizado.
  return buildProductDashboard(userId, productId, asOf)
}
