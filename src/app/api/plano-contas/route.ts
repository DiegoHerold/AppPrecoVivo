import { createGrupo, listTree, PlanoContaError } from '@/lib/plano-contas'
import { requireUser } from '@/lib/auth'
import { errorResponse } from '@/lib/http'
import { planoGrupoSchema } from '@/lib/validation'

export function planoContaError(error: unknown) {
  if (error instanceof PlanoContaError) return Response.json({ error: error.message }, { status: error.status })
  return errorResponse(error)
}

export async function GET(request: Request) {
  try {
    const user = await requireUser()
    const query = new URL(request.url).searchParams.get('q')
    return Response.json(await listTree(user.id, query))
  } catch (error) {
    return planoContaError(error)
  }
}

export async function POST(request: Request) {
  try {
    const [user, body] = await Promise.all([requireUser(), request.json().then((value) => planoGrupoSchema.parse(value))])
    const node = await createGrupo(user.id, {
      nome: body.nome,
      parentId: body.parentId ?? null,
      icone: body.icone,
      cor: body.cor,
      allowedUnits: body.allowedUnits,
      ativo: body.ativo,
    })
    return Response.json(node, { status: 201 })
  } catch (error) {
    return planoContaError(error)
  }
}
