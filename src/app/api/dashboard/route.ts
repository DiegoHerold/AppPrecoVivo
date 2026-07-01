import { requireUser } from '@/lib/auth'
import { errorResponse, readMonth, readOptionalMonth } from '@/lib/http'
import { getClassificationDashboard } from '@/lib/classification-report'

export async function GET(request: Request) {
  try {
    const [user, period] = await Promise.all([requireUser(), Promise.resolve(readMonth(request))])
    const categoryId = new URL(request.url).searchParams.get('categoryId')
    const reference = readOptionalMonth(request, 'compareYear', 'compareMonth')
    if (reference?.year === period.year && reference.month === period.month) {
      return Response.json({ error: 'Escolha meses diferentes para comparar.' }, { status: 400 })
    }
    return Response.json(await getClassificationDashboard(user.id, period.year, period.month, categoryId, new Date(), reference))
  } catch (error) {
    return errorResponse(error)
  }
}
