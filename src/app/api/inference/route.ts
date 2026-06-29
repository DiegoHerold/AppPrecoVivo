import { requireUser } from '@/lib/auth'
import { errorResponse } from '@/lib/http'
import {
  buildGeneralDashboard,
  buildProductDashboard,
} from '@/services/report.service'

/**
 * Motor de Inferência de Consumo — endpoint de leitura.
 *
 * GET /api/inference            -> dashboard geral (agregados de todos os produtos)
 * GET /api/inference?productId= -> dashboard de um produto específico
 *
 * Toda a regra de negócio vive em engine/ e services/. Esta rota apenas
 * autentica, delega e serializa.
 */
export async function GET(request: Request) {
  try {
    const user = await requireUser()
    const productId = new URL(request.url).searchParams.get('productId')

    if (productId) {
      const dashboard = await buildProductDashboard(user.id, productId)
      if (!dashboard) {
        return Response.json({ error: 'Produto não encontrado.' }, { status: 404 })
      }
      return Response.json(dashboard)
    }

    return Response.json(await buildGeneralDashboard(user.id))
  } catch (error) {
    return errorResponse(error)
  }
}
