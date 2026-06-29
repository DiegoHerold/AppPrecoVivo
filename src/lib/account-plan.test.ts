import assert from 'node:assert/strict'
import test from 'node:test'
import { INITIAL_CATEGORIES } from './categories'
import { accountCategorySchema, productUpdateSchema } from './validation'

test('plano inicial possui nomes únicos e pais válidos', () => {
  const names = new Set<string>()
  for (const category of INITIAL_CATEGORIES) {
    assert.equal(names.has(category.name), false, 'nome duplicado: ' + category.name)
    if (category.parent) assert.equal(names.has(category.parent), true, 'pai precisa aparecer antes do filho: ' + category.name)
    names.add(category.name)
  }
  assert.equal(names.has('Alimentação'), true)
  assert.equal(names.has('Básicos'), true)
  assert.equal(names.has('Arroz'), true)
})

test('valida criação e edição visual de classificação', () => {
  assert.equal(accountCategorySchema.safeParse({ name: 'Congelados', icon: '❄️', color: '#0EA5E9', parentId: null, allowedUnits: ['kg', 'g'] }).success, true)
  assert.equal(accountCategorySchema.safeParse({ name: 'X', icon: '', color: 'azul' }).success, false)
})

test('valida medida, comportamento e duração editáveis do produto', () => {
  const valid = {
    standardName: 'Arroz integral 5 kg',
    brand: 'Boa Safra',
    categoryId: 'categoria-arroz',
    behaviorType: 'estoque',
    estimatedDurationMonths: 2,
    defaultUnit: 'kg',
    packageSize: 'pacote 5 kg',
    applyToHistory: true,
  }
  assert.equal(productUpdateSchema.safeParse(valid).success, true)
  assert.equal(productUpdateSchema.safeParse({ ...valid, defaultUnit: 'galão' }).success, false)
  assert.equal(productUpdateSchema.safeParse({ ...valid, estimatedDurationMonths: 0 }).success, false)
})
