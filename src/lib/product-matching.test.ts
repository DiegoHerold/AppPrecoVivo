import test from 'node:test'
import assert from 'node:assert/strict'
import { learnedGroupFor, matchProductByAlias, type ProductMatchCandidate } from './product-matching'

function candidate(overrides: Partial<ProductMatchCandidate> = {}): ProductMatchCandidate {
  return {
    id: 'product-1',
    standardName: 'Leite Integral 1L',
    behaviorType: 'recorrente_semanal',
    estimatedDurationMonths: 1,
    classificationConfirmed: true,
    node: { id: 'node-1', parentId: 'laticinios' },
    aliases: [{ aliasName: 'LEITE INT 1LT', normalizedAliasName: 'leite integral' }],
    ...overrides,
  }
}

test('matching reutiliza catálogo em memória para aliases exatos e aproximados', () => {
  const products = [candidate()]
  assert.equal(matchProductByAlias(products, 'LEITE INTEGRAL')?.product.id, 'product-1')
  assert.equal(matchProductByAlias(products, 'Leite Integral 1L')?.confidence, 0.99)
})

test('classificação aprendida usa somente produtos confirmados do catálogo', () => {
  const confirmed = candidate()
  const unconfirmed = candidate({ id: 'product-2', classificationConfirmed: false, node: { id: 'node-2', parentId: 'outro' } })
  assert.equal(learnedGroupFor([confirmed, unconfirmed], 'Leite integral')?.groupId, 'laticinios')
})
