import { ZodError } from 'zod'

export function errorResponse(error: unknown) {
  if (error instanceof ZodError) {
    return Response.json({ error: error.issues[0]?.message ?? 'Dados inválidos.', issues: error.flatten().fieldErrors }, { status: 400 })
  }
  if (error instanceof Error && error.message === 'UNAUTHORIZED') {
    return Response.json({ error: 'Faça login para continuar.' }, { status: 401 })
  }
  if (error instanceof Error && (error.name.startsWith('PrismaClient') || error.message.includes('invocation'))) {
    console.error(error)
    return Response.json({ error: 'Não foi possível salvar os dados agora.' }, { status: 500 })
  }
  const message = error instanceof Error ? error.message : 'Não foi possível concluir esta ação.'
  console.error(error)
  return Response.json({ error: message }, { status: 500 })
}

export function readMonth(request: Request) {
  const url = new URL(request.url)
  const now = new Date()
  const year = Number(url.searchParams.get('year') ?? now.getFullYear())
  const month = Number(url.searchParams.get('month') ?? now.getMonth() + 1)
  if (!Number.isInteger(year) || year < 2000 || year > 2200 || !Number.isInteger(month) || month < 1 || month > 12) {
    throw new Error('Mês inválido.')
  }
  return { year, month }
}

export function readOptionalMonth(request: Request, yearParam: string, monthParam: string) {
  const url = new URL(request.url)
  const rawYear = url.searchParams.get(yearParam)
  const rawMonth = url.searchParams.get(monthParam)
  if (rawYear === null && rawMonth === null) return undefined
  const year = Number(rawYear)
  const month = Number(rawMonth)
  if (!Number.isInteger(year) || year < 2000 || year > 2200 || !Number.isInteger(month) || month < 1 || month > 12) {
    throw new Error('Mês de comparação inválido.')
  }
  return { year, month }
}
