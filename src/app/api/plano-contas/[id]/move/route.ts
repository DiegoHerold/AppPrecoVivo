import { moveNode } from '@/lib/plano-contas'
import { requireUser } from '@/lib/auth'
import { planoMoveSchema } from '@/lib/validation'
import { planoContaError } from '../../route'

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const [user, { id }, body] = await Promise.all([
      requireUser(),
      context.params,
      request.json().then((value) => planoMoveSchema.parse(value)),
    ])
    return Response.json(await moveNode(user.id, id, { parentId: body.parentId, ordem: body.ordem }))
  } catch (error) {
    return planoContaError(error)
  }
}
