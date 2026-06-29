import { requireUser } from '@/lib/auth'
import { errorResponse } from '@/lib/http'
import { getPurchaseSummary } from '@/lib/queries'

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const [user, route] = await Promise.all([requireUser(), params])
    const purchase = await getPurchaseSummary(user.id, route.id)
    return purchase ? Response.json(purchase) : Response.json({ error: 'Compra não encontrada.' }, { status: 404 })
  } catch (error) {
    return errorResponse(error)
  }
}

