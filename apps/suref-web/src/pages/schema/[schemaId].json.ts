import { getSchemaCatalog, getModel } from 'salvageunion-reference'
import type { APIRoute } from 'astro'

export function getStaticPaths() {
  const { schemas } = getSchemaCatalog()
  return schemas.map((schema) => {
    const model = getModel(schema.id)
    const data = model ? model.all() : []
    return {
      params: { schemaId: schema.id },
      props: { data },
    }
  })
}

export const GET: APIRoute = ({ props }) => {
  return new Response(JSON.stringify(props.data), {
    headers: { 'Content-Type': 'application/json' },
  })
}
