import { requireUser } from '@/lib/auth'
import { errorResponse } from '@/lib/http'
import { getProductDetail } from '@/lib/queries'
import { ProductUpdateError, updateProduct } from '@/lib/products'
import { productUpdateSchema } from '@/lib/validation'

function productError(error: unknown) {
  if (error instanceof ProductUpdateError) return Response.json({ error: error.message }, { status: error.status })
  return errorResponse(error)
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const [user, route] = await Promise.all([requireUser(), params])
    const product = await getProductDetail(user.id, route.id)
    return product ? Response.json(product) : Response.json({ error: 'Produto não encontrado.' }, { status: 404 })
  } catch (error) {
    return errorResponse(error)
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const [user, route, input] = await Promise.all([
      requireUser(),
      params,
      request.json().then((body) => productUpdateSchema.parse(body)),
    ])
    return Response.json(await updateProduct(user.id, route.id, input))
  } catch (error) {
    return productError(error)
  }
}
