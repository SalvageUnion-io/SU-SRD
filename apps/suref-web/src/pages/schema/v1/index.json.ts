import { getSchemaCatalog } from 'salvageunion-reference'

export function GET() {
  const catalog = getSchemaCatalog()
  return new Response(JSON.stringify(catalog), {
    headers: { 'Content-Type': 'application/json' },
  })
}
