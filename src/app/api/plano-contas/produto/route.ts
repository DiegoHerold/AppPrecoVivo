import { createProduto } from '@/lib/plano-contas'
import { requireUser } from '@/lib/auth'
import { planoProdutoSchema } from '@/lib/validation'
import { planoContaError } from '../route'

export async function POST(request: Request) {
  try {
    const [user, body] = await Promise.all([requireUser(), request.json().then((value) => planoProdutoSchema.parse(value))])
    const node = await createProduto(user.id, {
      standardName: body.standardName,
      groupId: body.groupId,
      behaviorType: body.behaviorType,
      estimatedDurationMonths: body.estimatedDurationMonths,
      defaultUnit: body.defaultUnit,
      brand: body.brand || null,
      packageSize: body.packageSize || null,
    })
    return Response.json(node, { status: 201 })
  } catch (error) {
    return planoContaError(error)
  }
}
