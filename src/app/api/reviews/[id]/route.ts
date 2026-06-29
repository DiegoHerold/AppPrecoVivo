import { requireUser } from '@/lib/auth'
import { errorResponse } from '@/lib/http'
import { confirmReview } from '@/lib/purchases'
import { reviewSchema } from '@/lib/validation'

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const [user, route, body] = await Promise.all([requireUser(), params, request.json()])
    await confirmReview(user.id, route.id, reviewSchema.parse(body))
    return Response.json({ success: true })
  } catch (error) {
    return errorResponse(error)
  }
}

