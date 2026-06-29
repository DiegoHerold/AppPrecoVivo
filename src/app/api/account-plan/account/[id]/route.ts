import { AccountPlanError, moveProductAccount } from '@/lib/account-plan'
import { requireUser } from '@/lib/auth'
import { errorResponse } from '@/lib/http'
import { moveProductAccountSchema } from '@/lib/validation'

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const [user, { id }, input] = await Promise.all([
      requireUser(),
      context.params,
      request.json().then((body) => moveProductAccountSchema.parse(body)),
    ])
    return Response.json(await moveProductAccount(user.id, id, input.categoryId))
  } catch (error) {
    if (error instanceof AccountPlanError) return Response.json({ error: error.message }, { status: error.status })
    return errorResponse(error)
  }
}
