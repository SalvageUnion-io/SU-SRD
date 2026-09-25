/**
 * Pure logic for slug-uniqueness validation (audit item 4).
 *
 * Entity URLs, deep links, and lookup helpers key on `nameToSlug(name)`
 * within a schema (srd routes /schema/[schemaId]/item/[slug],
 * findEntityBySlug, the Discord bot's name lookups). Two same-named entities
 * in one schema therefore SHADOW each other: only the first is reachable —
 * the second silently loses its page, JSON endpoint, og-image, and bot
 * autocomplete entry. This happened for real: two "Salvage Cache Table"
 * roll-tables (We Were Here First! p.23 vs Reclamation of the Wastes p.10)
 * collided until they were disambiguated by source.
 *
 * Cross-file collisions are fine (slugs are namespaced by schema). Entities
 * without a name (meta rows) are skipped — they slug by id, which
 * checkUniqueIds already guarantees unique.
 *
 * Pure over a caller-supplied data bag, so `tools/validate.ts` (the one CLI,
 * `--only=slugs`) and the tests share one implementation.
 */

import { nameToSlug } from '../lib/nameToSlug.js'

export type NamedEntity = { id?: string; name?: string; source?: string; page?: number }

export type SlugCollision = {
  file: string
  slug: string
  entities: NamedEntity[]
}

/** Find every slug shared by 2+ named entities within the same data file. */
export function findSlugCollisions(filesByName: Record<string, unknown[]>): SlugCollision[] {
  const collisions: SlugCollision[] = []

  for (const [file, raw] of Object.entries(filesByName)) {
    const bySlug = new Map<string, NamedEntity[]>()
    for (const entity of raw as NamedEntity[]) {
      if (typeof entity?.name !== 'string' || entity.name === '') continue
      const slug = nameToSlug(entity.name)
      const bucket = bySlug.get(slug)
      if (bucket) bucket.push(entity)
      else bySlug.set(slug, [entity])
    }

    for (const [slug, entities] of bySlug) {
      if (entities.length < 2) continue
      collisions.push({ file, slug, entities })
    }
  }

  return collisions
}
