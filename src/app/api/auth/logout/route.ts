import { deleteSession } from '@/lib/auth'
import { errorResponse } from '@/lib/http'

export async function POST() {
  try {
    await deleteSession()
    return new Response(null, { status: 204 })
  } catch (error) {
    return errorResponse(error)
  }
}

