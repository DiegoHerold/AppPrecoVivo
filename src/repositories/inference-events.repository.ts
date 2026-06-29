/** Persistência de snapshots derivados. A fonte de verdade continua sendo Purchase. */

import 'server-only'

import type { Prisma } from '../generated/prisma/client'
import type { InferenceEvent } from '../domain/entities'
import { prisma } from '../lib/prisma'

export async function replaceInferenceEventsForUser(
  userId: string,
  events: InferenceEvent[],
) {
  await prisma.$transaction(async (tx) => {
    await tx.inferenceEventLog.deleteMany({ where: { userId } })
    if (!events.length) return
    await tx.inferenceEventLog.createMany({
      data: events.map((event) => ({
        userId,
        productId: event.productId,
        eventKey: `${event.type}:${event.purchaseId ?? 'aggregate'}`,
        type: event.type,
        purchaseItemId: event.purchaseId,
        occurredAt: event.date,
        title: event.title,
        description: event.description,
        impact: event.impact,
        confidence: event.confidence,
        details: event.details as Prisma.InputJsonValue,
      })),
    })
  })
}

export async function listInferenceEvents(userId: string, productId: string) {
  return prisma.inferenceEventLog.findMany({
    where: { userId, productId },
    orderBy: { occurredAt: 'desc' },
  })
}
