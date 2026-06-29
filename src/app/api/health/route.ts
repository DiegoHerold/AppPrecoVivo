export async function GET() {
  return Response.json({ status: 'ok', database: 'postgresql' })
}

