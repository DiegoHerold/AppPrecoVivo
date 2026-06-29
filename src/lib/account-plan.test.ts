import assert from 'node:assert/strict'
import test from 'node:test'
import { INITIAL_GROUPS } from './plano-contas-seed'
import { planoGrupoSchema, planoProdutoSchema, productUpdateSchema } from './validation'

test('plano de contas inicial: pais aparecem antes dos filhos e nomes são únicos por nível', () => {
  const seen = new Set<string>()
  const childrenByParent = new Map<string, Set<string>>()
  for (const group of INITIAL_GROUPS) {
    if (group.parent) assert.equal(seen.has(group.parent), true, 'pai precisa vir antes do filho: ' + group.nome)
    const siblings = childrenByParent.get(group.parent ?? '__root__') ?? new Set<string>()
    assert.equal(siblings.has(group.nome), false, 'nome duplicado no mesmo nível: ' + group.nome)
    siblings.add(group.nome)
    childrenByParent.set(group.parent ?? '__root__', siblings)
    seen.add(group.nome)
  }
  assert.equal(seen.has('Alimentação'), true)
  assert.equal(seen.has('Aves'), true)
  assert.equal(seen.has('Frango'), true)
})

test('valida criação visual de grupo', () => {
  assert.equal(planoGrupoSchema.safeParse({ nome: 'Congelados', icone: '❄️', cor: '#0EA5E9', parentId: null, allowedUnits: ['kg', 'g'] }).success, true)
  assert.equal(planoGrupoSchema.safeParse({ nome: 'X', icone: '', cor: 'azul', allowedUnits: [] }).success, false)
})

test('valida criação de produto no plano de contas', () => {
  assert.equal(planoProdutoSchema.safeParse({ standardName: 'Peito de frango 1kg', groupId: 'grupo-aves', behaviorType: 'recorrente_semanal', defaultUnit: 'kg' }).success, true)
  assert.equal(planoProdutoSchema.safeParse({ standardName: 'P', groupId: '', behaviorType: 'recorrente_semanal', defaultUnit: 'kg' }).success, false)
  assert.equal(planoProdutoSchema.safeParse({ standardName: 'Arroz', groupId: 'g', behaviorType: 'estoque', defaultUnit: 'galão' }).success, false)
})

test('valida medida, comportamento e duração editáveis do produto', () => {
  const valid = {
    standardName: 'Arroz integral 5 kg',
    brand: 'Boa Safra',
    categoryId: 'grupo-arroz',
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
