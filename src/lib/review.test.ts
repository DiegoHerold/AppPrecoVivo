import assert from 'node:assert/strict'
import test from 'node:test'
import { reviewSchema } from './validation'

test('revisão pode confirmar nome e categoria sem sobrescrever recorrência', () => {
  const parsed = reviewSchema.parse({
    categoryId: 'grupo-1',
    standardName: 'Produto revisado',
  })
  assert.equal(parsed.behaviorType, undefined)
  assert.equal(parsed.estimatedDurationMonths, undefined)
})

test('revisão aceita alteração explícita de recorrência', () => {
  const parsed = reviewSchema.parse({
    categoryId: 'grupo-1',
    standardName: 'Produto revisado',
    behaviorType: 'recorrente_mensal',
    estimatedDurationMonths: 2,
  })
  assert.equal(parsed.behaviorType, 'recorrente_mensal')
  assert.equal(parsed.estimatedDurationMonths, 2)
})
