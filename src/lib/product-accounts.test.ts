import assert from 'node:assert/strict'
import test from 'node:test'
import type { Prisma } from '@/generated/prisma/client'
import { createProductWithAccount } from './product-accounts'

const input = {
  standardName: 'Arroz Integral 1kg',
  categoryId: 'categoria-arroz',
  behaviorType: 'estoque' as const,
  estimatedDurationMonths: 2,
  defaultUnit: 'kg',
  classificationConfirmed: true,
}

test('cria a conta de produto com os mesmos dados dentro da transação recebida', async () => {
  const calls: Array<{ entity: string; data: Record<string, unknown> }> = []
  const product = {
    id: 'produto-1',
    userId: 'usuario-1',
    standardName: input.standardName,
    categoryId: input.categoryId,
    active: true,
  }
  const tx = {
    product: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        calls.push({ entity: 'product', data })
        return product
      },
    },
    productAccount: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        calls.push({ entity: 'account', data })
        return { id: 'conta-1', ...data }
      },
    },
  } as unknown as Prisma.TransactionClient

  const result = await createProductWithAccount(tx, product.userId, input)

  assert.equal(result.product.id, product.id)
  assert.equal(result.account.id, 'conta-1')
  assert.deepEqual(calls.map((call) => call.entity), ['product', 'account'])
  assert.deepEqual(calls[1].data, {
    userId: product.userId,
    productId: product.id,
    name: product.standardName,
    type: 'PRODUTO',
    categoryId: product.categoryId,
    active: true,
  })
})

test('propaga a falha da conta para que a transação reverta o produto', async () => {
  const tx = {
    product: {
      create: async () => ({
        id: 'produto-2',
        userId: 'usuario-1',
        standardName: input.standardName,
        categoryId: input.categoryId,
        active: true,
      }),
    },
    productAccount: {
      create: async () => { throw new Error('falha ao criar conta') },
    },
  } as unknown as Prisma.TransactionClient

  await assert.rejects(() => createProductWithAccount(tx, 'usuario-1', input), /falha ao criar conta/)
})
