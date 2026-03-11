import { getSchemaCatalog } from 'salvageunion-reference'
import type { APIRoute } from 'astro'

export const GET: APIRoute = () => {
  const catalog = getSchemaCatalog()
  return new Response(JSON.stringify(catalog), {
    headers: { 'Content-Type': 'application/json' },
  })
}
