/**
 * Serviço de normalização de produtos.
 *
 * Reaproveita a normalização textual já existente (lib/domain) e a expõe sob a
 * nova arquitetura de serviços. Centralizar aqui evita regra de negócio
 * espalhada e prepara terreno para evoluções (ex.: dicionário de sinônimos).
 */

import {
  classificationSimilarity,
  normalizeProductName,
  textSimilarity,
} from '../lib/domain'

export const productNormalizationService = {
  normalize: normalizeProductName,
  textSimilarity,
  classificationSimilarity,
}
