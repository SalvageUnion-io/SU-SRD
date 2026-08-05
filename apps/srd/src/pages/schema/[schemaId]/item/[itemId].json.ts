import type { APIRoute } from 'astro'
import { getItemStaticPaths } from '../../../../lib/staticPaths'

export function getStaticPaths() {
  return getItemStaticPaths()
}

export const GET: APIRoute = ({ props }) => {
  return new Response(JSON.stringify(props.item), {
    headers: { 'Content-Type': 'application/json' },
  })
}
