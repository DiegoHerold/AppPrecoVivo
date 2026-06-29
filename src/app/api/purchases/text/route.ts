import { requireUser } from '@/lib/auth'
import { errorResponse } from '@/lib/http'
import { createPurchaseFromText } from '@/lib/purchases'

export async function POST(request: Request) {
  try {
    const [user, body] = await Promise.all([requireUser(), request.json()])
    return Response.json(await createPurchaseFromText(user.id, body), { status: 201 })
  } catch (error) {
    return errorResponse(error)
  }
}

