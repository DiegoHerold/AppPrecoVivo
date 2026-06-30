import { requireUser } from '@/lib/auth'
import { errorResponse } from '@/lib/http'
import { previewPendingImport } from '@/lib/purchases'

export async function POST(request: Request) {
  try {
    const [user, body] = await Promise.all([requireUser(), request.json()])
    return Response.json(await previewPendingImport(user.id, body))
  } catch (error) {
    return errorResponse(error)
  }
}
