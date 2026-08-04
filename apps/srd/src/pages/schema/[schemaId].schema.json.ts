import type { APIRoute } from 'astro'
import { getJsonSchemaDefinition } from 'salvageunion-reference/schema-definitions'
import { getSchemaCatalog } from '../../lib/gameData'

export function getStaticPaths() {
  const { schemas } = getSchemaCatalog()
  return schemas.map((schema) => {
    const definition = getJsonSchemaDefinition(schema.id)
    return {
      params: { schemaId: schema.id },
      props: { definition },
    }
  })
}

export const GET: APIRoute = ({ props }) => {
  return new Response(JSON.stringify(props.definition), {
    headers: { 'Content-Type': 'application/json' },
  })
}
