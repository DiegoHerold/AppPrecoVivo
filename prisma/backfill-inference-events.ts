import 'dotenv/config'
import { prisma } from '../src/lib/prisma'
import { syncInferenceEventsForUser } from '../src/services/inference-events.service'

async function main() {
  const users = await prisma.user.findMany({ select: { id: true } })
  let eventsCalculated = 0
  for (const user of users) {
    eventsCalculated += await syncInferenceEventsForUser(user.id)
  }

  const [products, orphanProducts, purchaseItems, inferenceEvents] = await Promise.all([
    prisma.product.count(),
    prisma.product.count({ where: { node: null } }),
    prisma.purchaseItem.count(),
    prisma.inferenceEventLog.count(),
  ])

  console.log(JSON.stringify({
    users: users.length,
    products,
    orphanProducts,
    purchaseItems,
    inferenceEvents,
    eventsCalculated,
  }))
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
