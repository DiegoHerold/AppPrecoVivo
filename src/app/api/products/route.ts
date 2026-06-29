import { requireUser } from '@/lib/auth'
import { errorResponse } from '@/lib/http'
import { listProducts } from '@/lib/queries'

export async function GET() {
  try {
    const user = await requireUser()
    return Response.json(await listProducts(user.id))
  } catch (error) {
    return errorResponse(error)
  }
}

