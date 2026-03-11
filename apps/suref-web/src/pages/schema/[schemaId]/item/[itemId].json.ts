import { getItemStaticPaths } from '../../../../lib/staticPaths'
import type { APIRoute } from 'astro'

export function getStaticPaths() {
  return getItemStaticPaths()
}

export const GET: APIRoute = ({ props }) => {
  return new Response(JSON.stringify(props.item), {
    headers: { 'Content-Type': 'application/json' },
  })
}
