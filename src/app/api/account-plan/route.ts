import { createAccountCategory, AccountPlanError, listAccountPlan } from '@/lib/account-plan'
import { requireUser } from '@/lib/auth'
import { errorResponse } from '@/lib/http'
import { accountCategorySchema } from '@/lib/validation'

function accountPlanError(error: unknown) {
  if (error instanceof AccountPlanError) return Response.json({ error: error.message }, { status: error.status })
  return errorResponse(error)
}

export async function GET() {
  try {
    const user = await requireUser()
    return Response.json(await listAccountPlan(user.id))
  } catch (error) {
    return accountPlanError(error)
  }
}

export async function POST(request: Request) {
  try {
    const [user, input] = await Promise.all([requireUser(), request.json().then((body) => accountCategorySchema.parse(body))])
    return Response.json(await createAccountCategory(user.id, input), { status: 201 })
  } catch (error) {
    return accountPlanError(error)
  }
}
