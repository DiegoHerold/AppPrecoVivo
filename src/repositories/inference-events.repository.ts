/**
 * Repositório de eventos de inferência.
 *
 * Decisão de arquitetura: os eventos são uma camada DERIVADA e totalmente
 * reconstruível a partir do histórico imutável de compras. Por isso, nesta
 * etapa eles são CALCULADOS sob demanda pelo motor, não persistidos — o que
 * elimina o risco de divergência entre histórico e eventos e dispensa
 * migração destrutiva.
 *
 * A interface abaixo já está pronta para uma futura persistência (cache em
 * tabela própria): basta implementar `save`/`listByProduct` contra o Prisma
 * sem mudar o motor. Mantemos a assinatura estável de propósito.
 */

import 'server-only'

import type { InferenceEvent } from '../domain/entities'

export interface InferenceEventsRepository {
  /** Eventos calculados de um produto (ordenados do mais recente ao mais antigo). */
  listByProduct(productId: string): Promise<InferenceEvent[]>
}

/**
 * Implementação em memória, alimentada pelo resultado do motor. Útil para a
 * camada de serviço e para testes. Não toca em banco.
 */
export function createInMemoryEventsRepository(
  eventsByProduct: Map<string, InferenceEvent[]>,
): InferenceEventsRepository {
  return {
    async listByProduct(productId: string) {
      return eventsByProduct.get(productId) ?? []
    },
  }
}
