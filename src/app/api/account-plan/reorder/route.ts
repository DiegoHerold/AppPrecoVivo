import { AccountPlanError, reorderAccountPlan } from '@/lib/account-plan'
import { requireUser } from '@/lib/auth'
import { errorResponse } from '@/lib/http'
import { accountPlanReorderSchema } from '@/lib/validation'

export async function POST(request: Request) {
  try {
    const [user, input] = await Promise.all([
      requireUser(),
      request.json().then((body) => accountPlanReorderSchema.parse(body)),
    ])
    return Response.json(await reorderAccountPlan(user.id, input))
  } catch (error) {
    if (error instanceof AccountPlanError) return Response.json({ error: error.message }, { status: error.status })
    return errorResponse(error)
  }
}
