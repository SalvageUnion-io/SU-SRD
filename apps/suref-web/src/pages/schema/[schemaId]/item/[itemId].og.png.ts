import type { APIRoute } from 'astro'
import { getItemStaticPaths } from '../../../../lib/staticPaths'
import { getReferenceEntityData, extractStaticEntitySummary } from '../../../../lib/gameData'
import { renderOgCard } from '../../../../lib/og/renderOgCard'

export function getStaticPaths() {
  return getItemStaticPaths()
}

export const GET: APIRoute = async ({ props }) => {
  const { item, schema, itemName, itemDescription } = props
  const summary = extractStaticEntitySummary(item)
  const displayData = getReferenceEntityData(item)

  const png = await renderOgCard({
    name: itemName,
    schemaName: schema.displayName || 'Reference',
    techLevel: summary.techLevel,
    description: summary.contentParagraphs[0] || itemDescription || undefined,
    stats: summary.stats,
    traits: summary.traits,
    source: displayData.source,
    page: displayData.page,
  })

  return new Response(new Blob([png], { type: 'image/png' }), {
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  })
}
