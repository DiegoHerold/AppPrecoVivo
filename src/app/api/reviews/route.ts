import { requireUser } from '@/lib/auth'
import { errorResponse } from '@/lib/http'
import { listReviews } from '@/lib/queries'

export async function GET() {
  try {
    const user = await requireUser()
    return Response.json(await listReviews(user.id))
  } catch (error) {
    return errorResponse(error)
  }
}

