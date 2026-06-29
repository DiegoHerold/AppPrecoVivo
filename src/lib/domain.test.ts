import test from 'node:test'
import assert from 'node:assert/strict'
import {
  calculateMonthlyFlow,
  classificationSimilarity,
  normalizeProductName,
  suggestProductBehavior,
  suggestLearnedCategory,
  textSimilarity,
  type FlowItem,
} from './domain'

test('normaliza nomes sem acentos e ruído fiscal', () => {
  assert.equal(normalizeProductName('ARROZ  Tipo 1 — 5kg'), 'arroz 1 5kg')
})

test('identifica aliases textualmente semelhantes', () => {
  assert.ok(textSimilarity('Leite Integral Languiru 1L', 'LEITE INTEGRAL LANGUIRU 1L') > 0.95)
  assert.equal(suggestProductBehavior('Arroz branco 5kg'), 'estoque')
})

test('reconhece famílias de produtos apesar de marca, tamanho e abreviação', () => {
  assert.ok(classificationSimilarity('PAPEL HIGIÊNICO DUETTO 16 UN', 'PAP HIG NEVE FOLHA DUPLA 12UN') > 0.5)
  assert.ok(classificationSimilarity('MACARRÃO PARAFUSO 500G', 'MACAR RENATA PARAF 1KG') > 0.5)
  assert.ok(classificationSimilarity('PAPEL HIGIÊNICO', 'PEITO DE FRANGO') < 0.3)
})

test('reaproveita uma classificação confirmada em produto semelhante', () => {
  const learned = suggestLearnedCategory('PAP HIG NEVE FOLHA DUPLA 12UN', [
    { categoryId: 'higiene', names: ['PAPEL HIGIÊNICO DUETTO 16 UN'] },
    { categoryId: 'aves', names: ['FILÉ DE FRANGO SASSAMI 1KG'] },
  ])
  assert.equal(learned?.categoryId, 'higiene')
})

test('separa desembolso, consumo e aumento de quantidade', () => {
  const current: FlowItem[] = [{ key: 'arroz', name: 'Arroz', quantity: 1, unitPrice: 30, totalPrice: 30, behaviorType: 'estoque', estimatedDurationMonths: 2 }]
  const previous: FlowItem[] = []
  const flow = calculateMonthlyFlow(current, previous)
  assert.equal(flow.totalSpent, 30)
  assert.equal(flow.estimatedConsumption, 15)
  assert.equal(flow.stockAmount, 15)
})
