import 'dotenv/config'
import { hash } from 'bcryptjs'
import { prisma } from '../src/lib/prisma'
import { normalizeProductName } from '../src/lib/domain'
import { createInitialPlanoContas } from '../src/lib/plano-contas-seed'
import { recalculateMonthlyFlow } from '../src/lib/monthly-flow'
import { syncInferenceEventsForUser } from '../src/services/inference-events.service'
import {
  buildProductionTestFixture,
  fixtureMonthCount,
  PRODUCTION_TEST_ACCOUNT_NAME,
} from '../src/lib/test-user-fixture'

function required(name: string) {
  const value = process.env[name]?.trim()
  if (!value) throw new Error(`${name} é obrigatória.`)
  return value
}

function validateGuard() {
  if (process.env.ALLOW_PRODUCTION_TEST_USER_SEED !== 'true') {
    throw new Error('Defina ALLOW_PRODUCTION_TEST_USER_SEED=true para autorizar esta operação.')
  }
  const connectionString = required('DATABASE_URL')
  const expectedHost = required('PRODUCTION_TEST_DATABASE_HOST').toLowerCase()
  const actualHost = new URL(connectionString).hostname.toLowerCase()
  if (actualHost !== expectedHost) {
    throw new Error('O hostname de DATABASE_URL não corresponde a PRODUCTION_TEST_DATABASE_HOST.')
  }
  if (['localhost', '127.0.0.1', '::1'].includes(actualHost)) {
    throw new Error('Este comando é reservado à conta permanente de homologação em produção.')
  }
}

function referenceDate() {
  const value = process.env.PRODUCTION_TEST_REFERENCE_DATE?.trim()
  if (!value) {
    const now = new Date()
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 23, 59, 59))
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error('PRODUCTION_TEST_REFERENCE_DATE deve usar o formato AAAA-MM-DD.')
  }
  const date = new Date(`${value}T12:00:00Z`)
  if (Number.isNaN(date.getTime())) throw new Error('PRODUCTION_TEST_REFERENCE_DATE é inválida.')
  return date
}

async function removeAccountData(tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0], userId: string) {
  const purchases = await tx.purchase.findMany({
    where: { userId },
    select: { storeId: true },
  })
  const oldStoreIds = [...new Set(purchases.flatMap((purchase) => purchase.storeId ? [purchase.storeId] : []))]

  await tx.session.deleteMany({ where: { userId } })
  await tx.monthlyInsight.deleteMany({ where: { userId } })
  await tx.monthlyFlow.deleteMany({ where: { userId } })
  await tx.inferenceEventLog.deleteMany({ where: { userId } })
  await tx.importJob.deleteMany({ where: { userId } })
  await tx.uploadedFile.deleteMany({ where: { userId } })
  await tx.purchase.deleteMany({ where: { userId } })
  await tx.product.deleteMany({ where: { userId } })

  // Após remover produtos, restam somente os grupos. A relação de árvore usa
  // Restrict, portanto a limpeza ocorre das folhas até as raízes.
  for (let level = 0; level < 100; level += 1) {
    const leaves = await tx.planoConta.findMany({
      where: { userId, children: { none: {} } },
      select: { id: true },
    })
    if (!leaves.length) break
    await tx.planoConta.deleteMany({ where: { id: { in: leaves.map((leaf) => leaf.id) } } })
  }
  const remainingNodes = await tx.planoConta.count({ where: { userId } })
  if (remainingNodes) throw new Error('Não foi possível limpar o plano de contas da conta de teste.')

  for (const storeId of oldStoreIds) {
    const store = await tx.store.findUnique({
      where: { id: storeId },
      select: { document: true, _count: { select: { purchases: true } } },
    })
    if (store?.document?.startsWith('TEST-HOMOLOG-') && store._count.purchases === 0) {
      await tx.store.delete({ where: { id: storeId } })
    }
  }
}

async function main() {
  validateGuard()
  const email = required('PRODUCTION_TEST_USER_EMAIL').toLowerCase()
  const password = required('PRODUCTION_TEST_USER_PASSWORD')
  if (!/^\S+@\S+\.\S+$/.test(email)) throw new Error('PRODUCTION_TEST_USER_EMAIL é inválido.')
  if (password.length < 12) throw new Error('PRODUCTION_TEST_USER_PASSWORD deve ter ao menos 12 caracteres.')

  const existing = await prisma.user.findUnique({
    where: { email },
    select: { id: true, isTestAccount: true },
  })
  if (existing && !existing.isTestAccount) {
    throw new Error('O e-mail informado pertence a uma conta comum. Nenhum dado foi alterado.')
  }

  const fixture = buildProductionTestFixture(referenceDate())
  const passwordHash = await hash(password, 12)
  const result = await prisma.$transaction(async (tx) => {
    const user = existing
      ? await tx.user.update({
        where: { id: existing.id },
        data: { name: PRODUCTION_TEST_ACCOUNT_NAME, passwordHash, isTestAccount: true },
      })
      : await tx.user.create({
        data: {
          name: PRODUCTION_TEST_ACCOUNT_NAME,
          email,
          passwordHash,
          isTestAccount: true,
        },
      })

    await removeAccountData(tx, user.id)
    await tx.userSettings.upsert({
      where: { userId: user.id },
      update: { notificationsEnabled: false, monthlySummaryEnabled: false, priceAlertsEnabled: true },
      create: {
        userId: user.id,
        notificationsEnabled: false,
        monthlySummaryEnabled: false,
        priceAlertsEnabled: true,
      },
    })
    await createInitialPlanoContas(tx, user.id)

    const groups = await tx.planoConta.findMany({
      where: { userId: user.id, tipo: 'GRUPO' },
      select: { id: true, nome: true, allowedUnits: true },
    })
    const groupByName = new Map(groups.map((group) => [group.nome, group]))
    const productByKey = new Map<string, { id: string; nodeId: string }>()
    const orderByGroup = new Map<string, number>()

    for (const spec of fixture.products) {
      const group = groupByName.get(spec.category)
      if (!group) throw new Error(`Categoria ausente no plano de teste: ${spec.category}.`)
      const product = await tx.product.create({
        data: {
          userId: user.id,
          standardName: spec.name,
          behaviorType: spec.behaviorType,
          estimatedDurationMonths: spec.estimatedDurationMonths,
          defaultUnit: spec.defaultUnit,
          classificationConfirmed: true,
        },
      })
      const ordem = orderByGroup.get(group.id) ?? 0
      orderByGroup.set(group.id, ordem + 1)
      const node = await tx.planoConta.create({
        data: {
          userId: user.id,
          nome: spec.name,
          tipo: 'PRODUTO',
          parentId: group.id,
          produtoId: product.id,
          ordem,
          icone: '📦',
          cor: '#635BFF',
          allowedUnits: group.allowedUnits,
        },
      })
      await tx.productAlias.create({
        data: {
          productId: product.id,
          aliasName: spec.name,
          normalizedAliasName: normalizeProductName(spec.name),
          source: 'seed_homologacao',
        },
      })
      productByKey.set(spec.key, { id: product.id, nodeId: node.id })
    }

    const storeByKey = new Map<string, string>()
    for (const spec of fixture.stores) {
      const store = await tx.store.create({
        data: { name: spec.name, type: spec.type, document: spec.document },
      })
      storeByKey.set(spec.key, store.id)
    }

    let itemCount = 0
    for (const draft of fixture.purchases) {
      const items = draft.items.map((item) => {
        const spec = fixture.products.find((product) => product.key === item.productKey)
        const product = productByKey.get(item.productKey)
        if (!spec || !product) throw new Error(`Produto ausente na fixture: ${item.productKey}.`)
        const totalPrice = Math.round(item.quantity * item.unitPrice * 100) / 100
        return {
          rawName: spec.name,
          normalizedName: normalizeProductName(spec.name),
          productId: product.id,
          planoContaId: product.nodeId,
          quantity: item.quantity,
          unit: item.unit,
          unitPrice: item.unitPrice,
          totalPrice,
          behaviorType: spec.behaviorType,
          estimatedDurationMonths: spec.estimatedDurationMonths,
          matchConfidence: item.needsReview ? 0.6 : 1,
          needsReview: item.needsReview ?? false,
        }
      })
      itemCount += items.length
      const totalAmount = Math.round(items.reduce((sum, item) => sum + item.totalPrice, 0) * 100) / 100
      const storeId = storeByKey.get(draft.storeKey)
      if (!storeId) throw new Error(`Loja ausente na fixture: ${draft.storeKey}.`)
      await tx.purchase.create({
        data: {
          userId: user.id,
          storeId,
          purchaseDate: draft.date,
          totalAmount,
          importStatus: 'importacao_manual',
          reviewStatus: items.some((item) => item.needsReview) ? 'aguardando_revisao' : 'concluida',
          items: { create: items },
          importJobs: {
            create: {
              userId: user.id,
              inputType: 'manual',
              status: 'concluida',
              errorMessage: null,
            },
          },
        },
      })
    }

    return { userId: user.id, itemCount }
  }, { maxWait: 20_000, timeout: 120_000 })

  const months = new Map<string, Date>()
  for (const purchase of fixture.purchases) {
    months.set(`${purchase.date.getUTCFullYear()}-${purchase.date.getUTCMonth() + 1}`, purchase.date)
  }
  for (const date of months.values()) {
    await recalculateMonthlyFlow(result.userId, date.getUTCFullYear(), date.getUTCMonth() + 1)
  }
  await syncInferenceEventsForUser(result.userId, fixture.referenceDate)

  console.log(JSON.stringify({
    email,
    result: 'created_or_refreshed',
    months: fixtureMonthCount(fixture.purchases),
    purchases: fixture.purchases.length,
    items: result.itemCount,
    products: fixture.products.length,
    stores: fixture.stores.length,
  }))
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : 'Falha ao criar a conta de homologação.')
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
