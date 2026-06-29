import { removeNode, updateNode } from '@/lib/plano-contas'
import { requireUser } from '@/lib/auth'
import { planoGrupoUpdateSchema } from '@/lib/validation'
import { planoContaError } from '../route'

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const [user, { id }, body] = await Promise.all([
      requireUser(),
      context.params,
      request.json().then((value) => planoGrupoUpdateSchema.parse(value)),
    ])
    return Response.json(await updateNode(user.id, id, body))
  } catch (error) {
    return planoContaError(error)
  }
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const [user, { id }] = await Promise.all([requireUser(), context.params])
    const hard = new URL(request.url).searchParams.get('hard') === '1'
    return Response.json(await removeNode(user.id, id, hard))
  } catch (error) {
    return planoContaError(error)
  }
}
