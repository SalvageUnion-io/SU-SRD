/**
 * Build-time compact search index generator (Node-only — imports gameData.ts,
 * which preloads the full ORM at module load; never import this from a
 * client island). Consumed by `src/pages/search-index.json.ts`, an Astro
 * static endpoint generated once at `astro build` and fetched lazily by
 * `useSearchIndex.ts` on first search interaction.
 *
 * Mirrors the field extraction `salvageunion-reference`'s internal
 * `buildSearchIndex` (lib/search.ts) uses — name, description, effect,
 * goals, assets, weaknesses, content, and resolved action content — but
 * flattens everything into one lowercased `text` field and drops the full
 * entity, since the client only needs to match a query and link to the
 * entity's page (see `searchIndexTypes.ts`). This is a deliberate,
 * documented trade-off (see `searchCompactIndex.ts`): the client matcher
 * loses per-field match weighting, in exchange for not shipping the full
 * corpus to the browser.
 */
import { getEntitySchemas, getModel, SalvageUnionReference } from './gameData'
import { getEntitySlug } from 'salvageunion-reference'
import type { SURefEntity, SURefMetaEntity } from 'salvageunion-reference'
import type { CompactSearchEntry } from './searchIndexTypes'

/** Recursively extract display text from a ContentBlock tree (mirrors
 *  salvageunion-reference's internal search.ts#extractContentText). */
function extractContentText(content: unknown): string {
  if (!content) return ''
  if (Array.isArray(content)) return content.map(extractContentText).join(' ')
  if (typeof content === 'object' && content !== null) {
    const block = content as Record<string, unknown>
    let text = ''
    if ('value' in block && typeof block.value === 'string') text += block.value + ' '
    if ('label' in block && typeof block.label === 'string') text += block.label + ' '
    if ('items' in block && Array.isArray(block.items)) text += extractContentText(block.items)
    return text
  }
  return ''
}

const TEXT_FIELDS = ['description', 'effect', 'goals', 'assets', 'weaknesses'] as const

export function buildSearchIndexEntries(): CompactSearchEntry[] {
  const entries: CompactSearchEntry[] = []

  for (const schema of getEntitySchemas()) {
    const model = getModel(schema.id)
    if (!model) continue

    for (const entity of model.all() as SURefEntity[]) {
      const parts: string[] = [entity.name]

      for (const field of TEXT_FIELDS) {
        if (field in entity && typeof (entity as Record<string, unknown>)[field] === 'string') {
          parts.push((entity as Record<string, unknown>)[field] as string)
        }
      }

      if ('content' in entity && (entity as Record<string, unknown>).content) {
        parts.push(extractContentText((entity as Record<string, unknown>).content))
      }

      const resolvedActions = SalvageUnionReference.resolveActions(entity as SURefMetaEntity)
      if (resolvedActions) {
        for (const action of resolvedActions) {
          if (action && typeof action === 'object' && 'content' in action) {
            parts.push(extractContentText((action as { content: unknown }).content))
          }
        }
      }

      entries.push({
        id: entity.id,
        name: entity.name,
        slug: getEntitySlug(entity),
        schemaName: schema.id,
        schemaTitle: schema.title,
        text: parts.join(' ').toLowerCase(),
      })
    }
  }

  return entries
}
