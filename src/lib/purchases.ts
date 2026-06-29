import type { BehaviorType, ImportInputType, Prisma } from '@/generated/prisma/client'
import path from 'node:path'
import { prisma } from '@/lib/prisma'
import { classificationSimilarity, estimateProductDuration, normalizeProductName, suggestLearnedCategory, textSimilarity } from '@/lib/domain'
import { accessKeyFrom, importerFor, ManualTextImporter } from '@/lib/importers'
import { manualPurchaseSchema, pendingImportSchema, rawTextImportSchema } from '@/lib/validation'
import { recalculatePurchaseMonth } from '@/lib/monthly-flow'
import { syncInferenceEventsForUser } from '@/services/inference-events.service'
import { createProdutoWithNode } from '@/lib/plano-contas'

type Tx = Prisma.TransactionClient

export async function matchProductByAlias(tx: Tx, userId: string, rawName: string) {
  const normalized = normalizeProductName(rawName)
  const exact = await tx.productAlias.findFirst({
    where: { normalizedAliasName: normalized, product: { userId, active: true } },
    include: { product: { include: { node: true } } },
  })
  if (exact) {
    if (!exact.product.node) throw new Error('Produto sem nó correspondente no plano de contas.')
    return { product: exact.product, node: exact.product.node, confidence: 0.99 }
  }

  const products = await tx.product.findMany({
    where: { userId, active: true },
    include: { node: true, aliases: { select: { aliasName: true } } },
  })
  let best: (typeof products)[number] | null = null
  let confidence = 0
  for (const product of products) {
    const candidates = [product.standardName, ...product.aliases.map((alias) => alias.aliasName)]
    const score = Math.max(...candidates.map((candidate) => {
      const textual = textSimilarity(candidate, rawName)
      return Math.max(textual, textual * 0.72 + classificationSimilarity(candidate, rawName) * 0.28)
    }))
    if (score > confidence) { best = product; confidence = score }
  }
  if (!best || confidence < 0.78) return null
  if (!best.node) throw new Error('Produto sem nó correspondente no plano de contas.')
  return { product: best, node: best.node, confidence }
}

async function learnedGroupFor(tx: Tx, userId: string, rawName: string) {
  const products = await tx.product.findMany({
    where: { userId, active: true, classificationConfirmed: true },
    include: { node: { select: { parentId: true } }, aliases: { select: { aliasName: true } } },
  })
  const learned = suggestLearnedCategory(rawName, products.flatMap((product) => (product.node?.parentId
    ? [{ categoryId: product.node.parentId, names: [product.standardName, ...product.aliases.map((alias) => alias.aliasName)] }]
    : [])))
  if (!learned) return null
  return { groupId: learned.categoryId, confidence: Math.min(0.94, Math.round((0.68 + learned.score * 0.28) * 100) / 100) }
}

type ManualInput = ReturnType<typeof manualPurchaseSchema.parse>
type PurchaseSource = {
  inputType: ImportInputType
  inputValue?: string | null
  fileUrl?: string | null
  message?: string | null
}

async function persistManualPurchase(userId: string, input: ManualInput, source: PurchaseSource = { inputType: 'manual' }) {
  const purchaseDate = new Date(`${input.purchaseDate}T12:00:00.000Z`)
  const purchase = await prisma.$transaction(async (tx) => {
    const groupIds = input.items.map((item) => item.categoryId)
    const groups = await tx.planoConta.findMany({
      where: { userId, tipo: 'GRUPO', ativo: true, id: { in: groupIds } },
      select: { id: true },
    })
    if (new Set(groups.map((group) => group.id)).size !== new Set(groupIds).size) {
      throw new Error('Um dos grupos não pertence à sua conta.')
    }

    const store = await tx.store.create({
      data: {
        name: input.storeName,
        type: input.storeType,
        document: input.storeDocument || null,
        city: input.city || null,
        state: input.state?.toUpperCase() || null,
      },
    })

    const resolvedItems = []
    for (const item of input.items) {
      const match = await matchProductByAlias(tx, userId, item.rawName)
      if (match) {
        resolvedItems.push({
          ...item,
          productId: match.product.id,
          planoContaId: match.node.id,
          behaviorType: match.product.behaviorType,
          estimatedDurationMonths: Number(match.product.estimatedDurationMonths),
          confidence: match.confidence,
          needsReview: match.confidence < 0.85,
        })
        continue
      }

      const learned = await learnedGroupFor(tx, userId, item.rawName)
      const manuallyClassified = source.inputType === 'manual'
      const confidence = manuallyClassified ? 1 : learned?.confidence ?? 0.45
      const { product, node } = await createProdutoWithNode(tx, userId, {
        standardName: item.rawName,
        groupId: learned?.groupId ?? item.categoryId,
        behaviorType: item.behaviorType,
        estimatedDurationMonths: item.estimatedDurationMonths,
        defaultUnit: item.unit,
        classificationConfirmed: manuallyClassified,
        active: true,
      })
      resolvedItems.push({ ...item, productId: product.id, planoContaId: node.id, confidence, needsReview: !manuallyClassified && confidence < 0.85 })
    }

    const created = await tx.purchase.create({
      data: {
        userId,
        storeId: store.id,
        accessKey: input.accessKey || null,
        nfceUrl: input.nfceUrl || null,
        purchaseDate,
        totalAmount: input.totalAmount,
        importStatus: source.inputType === 'manual' ? 'importacao_manual' : 'importada',
        reviewStatus: resolvedItems.some((item) => item.needsReview) ? 'aguardando_revisao' : 'concluida',
        items: {
          create: resolvedItems.map((item) => ({
            rawName: item.rawName,
            normalizedName: normalizeProductName(item.rawName),
            productId: item.productId,
            planoContaId: item.planoContaId,
            quantity: item.quantity,
            unit: item.unit,
            unitPrice: item.unitPrice,
            totalPrice: Math.round(item.quantity * item.unitPrice * 100) / 100,
            behaviorType: item.behaviorType,
            estimatedDurationMonths: item.estimatedDurationMonths,
            matchConfidence: item.confidence,
            needsReview: item.needsReview,
          })),
        },
        importJobs: {
          create: { userId, inputType: source.inputType, inputValue: source.inputValue, fileUrl: source.fileUrl, status: 'concluida', errorMessage: source.message },
        },
      },
      select: { id: true, purchaseDate: true, importJobs: { select: { status: true, errorMessage: true } } },
    })
    return created
  })

  await recalculatePurchaseMonth(userId, purchase.purchaseDate)
  await syncInferenceEventsForUser(userId)
  return purchase
}

export async function createManualPurchase(userId: string, unknownInput: unknown) {
  return persistManualPurchase(userId, manualPurchaseSchema.parse(unknownInput))
}

function suggestedGroupName(rawName: string) {
  const normalized = normalizeProductName(rawName)
  if (/pimentao|cebola|abobora|legume/.test(normalized)) return 'Legumes'
  if (/frango|sassami|filezin/.test(normalized)) return 'Aves'
  if (/arroz|feijao|aveia|macarrao|\bmacar\b|espaguete/.test(normalized)) return 'Grãos e Cereais'
  if (/sabao|detergente|amaciante|limpador/.test(normalized)) return 'Limpeza'
  if (/shampoo|sabonete|papel higienico|pap hig|desodorante|creme dental/.test(normalized)) return 'Higiene'
  if (/cafe|suco|agua|refrigerante/.test(normalized)) return 'Bebidas'
  if (/pao|bolo|biscoito/.test(normalized)) return 'Padaria'
  if (/remedio|dipirona|paracetamol/.test(normalized)) return 'Medicamentos'
  if (/leite|queijo|iogurte/.test(normalized)) return 'Laticínios'
  return 'Alimentação'
}

async function selectableGroups(userId: string) {
  const groups = await prisma.planoConta.findMany({ where: { userId, tipo: 'GRUPO', ativo: true } })
  const fallback = groups.find((group) => group.nome === 'Outros') ?? groups[0]
  if (!fallback) throw new Error('Sua conta ainda não possui grupos no plano de contas.')
  const resolve = (rawName: string) => (groups.find((group) => group.nome === suggestedGroupName(rawName)) ?? fallback).id
  return { resolve }
}

export async function createPurchaseFromText(userId: string, unknownInput: unknown) {
  const input = rawTextImportSchema.parse(unknownInput)
  const result = await new ManualTextImporter().import(input.rawText)
  if (result.status !== 'concluida' || !result.items) throw new Error(result.message)
  const { resolve } = await selectableGroups(userId)
  const items = result.items.map((item) => ({
    rawName: item.rawName,
    quantity: item.quantity,
    unit: item.unit,
    unitPrice: item.unitPrice,
    categoryId: resolve(item.rawName),
    behaviorType: item.behaviorType,
    estimatedDurationMonths: estimateProductDuration(item.behaviorType, item.rawName),
  }))
  return persistManualPurchase(userId, {
    storeName: input.storeName,
    storeType: input.storeType,
    purchaseDate: input.purchaseDate,
    totalAmount: Math.round(items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0) * 100) / 100,
    items,
  }, { inputType: 'raw_text', inputValue: input.rawText, message: result.message })
}

export async function createPendingImport(userId: string, unknownInput: unknown) {
  const input = pendingImportSchema.parse(unknownInput)
  const findExisting = (accessKey: string) => prisma.purchase.findFirst({
    where: { userId, accessKey, items: { some: {} } },
    select: { id: true, purchaseDate: true, importJobs: { select: { status: true, errorMessage: true } } },
  })
  const duplicateResponse = (existing: NonNullable<Awaited<ReturnType<typeof findExisting>>>, itemCount = 0) => ({
    ...existing,
    imported: false,
    duplicate: true,
    itemCount,
    message: 'Esta NFC-e já foi importada. Nenhum dado foi duplicado.',
    errorCode: 'already_imported' as const,
  })
  const directKey = accessKeyFrom(input.inputValue ?? input.accessKey ?? input.nfceUrl ?? '')
  if (directKey) {
    const existing = await findExisting(directKey)
    if (existing) return duplicateResponse(existing)
  }

  const importer = importerFor(input.inputType as ImportInputType)
  let importerInput = input.inputValue ?? input.fileUrl ?? ''
  if (input.inputType === 'image') {
    const uploadId = input.fileUrl?.match(/^\/api\/uploads\/([^/?#]+)$/)?.[1]
    const uploaded = uploadId ? await prisma.uploadedFile.findFirst({ where: { id: uploadId, userId } }) : null
    if (!uploaded) throw new Error('A foto enviada não foi encontrada na sua conta.')
    const root = path.resolve(process.cwd(), 'storage', 'uploads')
    const absolutePath = path.resolve(root, uploaded.storagePath)
    if (!absolutePath.startsWith(root + path.sep)) throw new Error('Caminho de foto inválido.')
    importerInput = absolutePath
  }
  const result = await importer.import(importerInput)
  if (result.status === 'concluida' && result.items?.length && result.receipt) {
    const existing = await findExisting(result.receipt.accessKey)
    if (existing) return duplicateResponse(existing, result.items.length)

    const { resolve } = await selectableGroups(userId)
    const items = result.items.map((item) => ({
      ...item,
      categoryId: resolve(item.rawName),
      estimatedDurationMonths: estimateProductDuration(item.behaviorType, item.rawName),
    }))
    try {
      const purchase = await persistManualPurchase(userId, {
        storeName: result.receipt.storeName,
        storeType: 'mercado',
        storeDocument: result.receipt.storeDocument,
        city: result.receipt.city,
        state: result.receipt.state,
        purchaseDate: result.receipt.purchaseDate,
        totalAmount: result.receipt.totalAmount,
        accessKey: result.receipt.accessKey,
        nfceUrl: result.receipt.nfceUrl,
        items,
      }, {
        inputType: input.inputType as ImportInputType,
        inputValue: input.inputValue,
        fileUrl: input.fileUrl,
        message: result.message,
      })
      return { ...purchase, imported: true, duplicate: false, itemCount: result.items.length, message: result.message, accessKey: result.receipt.accessKey }
    } catch (error) {
      if (typeof error === 'object' && error && 'code' in error && error.code === 'P2002') {
        const raced = await findExisting(result.receipt.accessKey)
        if (raced) return duplicateResponse(raced, result.items.length)
      }
      throw error
    }
  }
  const pending = await prisma.importJob.create({
    data: {
      userId,
      inputType: input.inputType,
      inputValue: input.inputValue || input.accessKey || input.nfceUrl || null,
      fileUrl: input.fileUrl || null,
      status: result.status,
      errorMessage: result.message,
    },
    select: { id: true, status: true, errorMessage: true },
  })
  return {
    id: null,
    jobId: pending.id,
    importJobs: [{ status: pending.status, errorMessage: pending.errorMessage }],
    imported: false,
    duplicate: false,
    itemCount: 0,
    message: result.message,
    errorCode: result.errorCode,
    detectedAccessKey: result.detectedAccessKey,
  }
}

export async function confirmReview(userId: string, itemId: string, input: {
  standardName: string
  categoryId: string
  behaviorType?: BehaviorType
  estimatedDurationMonths?: number
}) {
  const result = await prisma.$transaction(async (tx) => {
    const item = await tx.purchaseItem.findFirst({
      where: { id: itemId, purchase: { userId } },
      include: { product: { include: { node: true } }, purchase: { select: { id: true, purchaseDate: true } } },
    })
    if (!item) throw new Error('Item não encontrado.')
    if (!item.product.node) throw new Error('Produto sem nó correspondente no plano de contas.')
    const behaviorType = input.behaviorType ?? item.product.behaviorType
    const estimatedDurationMonths = input.estimatedDurationMonths ?? Number(item.product.estimatedDurationMonths)
    const group = await tx.planoConta.findFirst({ where: { id: input.categoryId, userId, tipo: 'GRUPO', ativo: true } })
    if (!group) throw new Error('Grupo inválido.')
    await tx.product.update({
      where: { id: item.productId },
      data: {
        standardName: input.standardName,
        behaviorType: input.behaviorType ?? undefined,
        estimatedDurationMonths: input.estimatedDurationMonths ?? undefined,
        classificationConfirmed: true,
      },
    })
    // Renomeia e move o nó PRODUTO para o grupo escolhido (mantém o mesmo planoContaId no histórico).
    await tx.planoConta.update({
      where: { id: item.product.node.id },
      data: { nome: input.standardName, parentId: input.categoryId },
    })
    await tx.productAlias.upsert({
      where: { productId_normalizedAliasName: { productId: item.productId, normalizedAliasName: item.normalizedName } },
      update: { aliasName: item.rawName, source: 'revisao_usuario' },
      create: { productId: item.productId, aliasName: item.rawName, normalizedAliasName: item.normalizedName, source: 'revisao_usuario' },
    })
    await tx.purchaseItem.update({
      where: { id: item.id },
      data: {
        behaviorType,
        estimatedDurationMonths,
        matchConfidence: 1,
        needsReview: false,
      },
    })
    const pending = await tx.purchaseItem.count({ where: { purchaseId: item.purchase.id, needsReview: true } })
    if (!pending) await tx.purchase.update({ where: { id: item.purchase.id }, data: { reviewStatus: 'concluida' } })
    return item.purchase
  })
  await recalculatePurchaseMonth(userId, result.purchaseDate)
  await syncInferenceEventsForUser(userId)
  return result
}
