import { AccountPlanError, deleteAccountCategory, updateAccountCategory } from '@/lib/account-plan'
import { requireUser } from '@/lib/auth'
import { errorResponse } from '@/lib/http'
import { accountCategoryUpdateSchema } from '@/lib/validation'

function accountPlanError(error: unknown) {
  if (error instanceof AccountPlanError) return Response.json({ error: error.message }, { status: error.status })
  return errorResponse(error)
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const [user, { id }, input] = await Promise.all([
      requireUser(),
      context.params,
      request.json().then((body) => accountCategoryUpdateSchema.parse(body)),
    ])
    return Response.json(await updateAccountCategory(user.id, id, input))
  } catch (error) {
    return accountPlanError(error)
  }
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const [user, { id }] = await Promise.all([requireUser(), context.params])
    return Response.json(await deleteAccountCategory(user.id, id))
  } catch (error) {
    return accountPlanError(error)
  }
}
