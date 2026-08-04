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
// `extractContentText` and `isSchemaName` are the package's own primitives —
// this module is Node-only and already loads the ORM, so importing them costs
// nothing and keeps the index's field extraction byte-identical to the
// ORM-backed `search()` it mirrors.
import { extractContentText, getEntitySlug, isSchemaName } from 'salvageunion-reference'
import type { CompactSearchEntry } from './searchIndexTypes'

const TEXT_FIELDS = ['description', 'effect', 'goals', 'assets', 'weaknesses'] as const

export function buildSearchIndexEntries(): CompactSearchEntry[] {
  const entries: CompactSearchEntry[] = []

  for (const schema of getEntitySchemas()) {
    // Runtime-validated narrowing (string catalog id → schema name) instead
    // of asserting; getEntitySchemas() only yields canonical schema ids, so
    // this never actually skips.
    if (!isSchemaName(schema.id)) continue
    const model = getModel(schema.id)
    if (!model) continue

    for (const entity of model.all()) {
      const parts: string[] = [entity.name]

      // Entity union members are object-literal types, so they satisfy the
      // implicit string index signature — an annotation, not a cast.
      const record: Record<string, unknown> = entity
      for (const field of TEXT_FIELDS) {
        const value = record[field]
        if (typeof value === 'string') parts.push(value)
      }

      if (record.content) {
        parts.push(extractContentText(record.content))
      }

      const resolvedActions = SalvageUnionReference.resolveActions(entity)
      if (resolvedActions) {
        for (const action of resolvedActions) {
          if (action && typeof action === 'object' && 'content' in action) {
            parts.push(extractContentText(action.content))
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
