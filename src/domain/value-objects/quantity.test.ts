import test from 'node:test'
import assert from 'node:assert/strict'
import { convertQuantity, toStandardUnit, unitFamily } from './quantity'

test('converte massa entre g e kg', () => {
  assert.equal(convertQuantity(500, 'g', 'kg'), 0.5)
  assert.equal(convertQuantity(2, 'kg', 'g'), 2000)
})

test('converte volume entre ml e l', () => {
  assert.equal(convertQuantity(1500, 'ml', 'l'), 1.5)
})

test('não converte entre famílias diferentes', () => {
  assert.equal(convertQuantity(1, 'kg', 'l'), null)
})

test('unidade desconhecida não converte', () => {
  assert.equal(convertQuantity(1, 'sache', 'kg'), null)
})

test('toStandardUnit converte e sinaliza sucesso', () => {
  const result = toStandardUnit({ amount: 500, unit: 'g' }, 'kg')
  assert.deepEqual(result, { amount: 0.5, unit: 'kg', converted: true })
})

test('toStandardUnit degrada quando não consegue converter', () => {
  const result = toStandardUnit({ amount: 3, unit: 'sache' }, 'kg')
  assert.equal(result.converted, false)
  assert.equal(result.amount, 3)
})

test('família da unidade é detectada e normalizada (acentos/caixa)', () => {
  assert.equal(unitFamily('KG'), 'mass')
  assert.equal(unitFamily('Litro'), 'volume')
  assert.equal(unitFamily('un'), 'count')
})
