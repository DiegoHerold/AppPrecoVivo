import { requireUser } from '@/lib/auth'
import { errorResponse, readMonth } from '@/lib/http'
import { getClassificationDashboard } from '@/lib/classification-report'

export async function GET(request: Request) {
  try {
    const user = await requireUser()
    const { year, month } = readMonth(request)
    return Response.json((await getClassificationDashboard(user.id, year, month)).categories)
  } catch (error) {
    return errorResponse(error)
  }
}
