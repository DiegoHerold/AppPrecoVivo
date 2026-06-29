import { requireUser } from '@/lib/auth'
import { errorResponse, readMonth } from '@/lib/http'
import { getClassificationDashboard } from '@/lib/classification-report'

export async function GET(request: Request) {
  try {
    const [user, period] = await Promise.all([requireUser(), Promise.resolve(readMonth(request))])
    const categoryId = new URL(request.url).searchParams.get('categoryId')
    return Response.json(await getClassificationDashboard(user.id, period.year, period.month, categoryId))
  } catch (error) {
    return errorResponse(error)
  }
}
