/**
 * Pure logic for slug-uniqueness validation.
 *
 * Entity URLs, deep links, and lookup helpers key on `nameToSlug(name)`
 * within a schema (srd routes /[schemaId]/[slug],
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

import { nameToSlug } from '../lib/nameToSlug'

export type NamedEntity = { id?: string; name?: string; source?: string; page?: number }

export type SlugCollision = {
  file: string
  slug: string
  entities: NamedEntity[]
}

function formerSlugsOf(entity: NamedEntity): { slug: string; pattern: string }[] {
  const patterns = (entity as { patterns?: unknown }).patterns
  if (!Array.isArray(patterns)) return []
  return patterns.flatMap((pattern: { name?: unknown; formerSlugs?: unknown }) =>
    Array.isArray(pattern.formerSlugs)
      ? pattern.formerSlugs
          .filter((slug): slug is string => typeof slug === 'string')
          .map((slug) => ({ slug, pattern: String(pattern.name) }))
      : []
  )
}

/**
 * Find every slug shared by 2+ named entities within the same data file —
 * counting a pattern's former slugs, which still answer in that file's schema.
 */
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
      // A pattern's former slugs (ADR-043) still answer in this schema, so one
      // that matches a live row, or another former slug, shadows it.
      for (const former of formerSlugsOf(entity)) {
        const named = { name: `${former.pattern} (former slug, pattern of ${entity.name})` }
        const formerBucket = bySlug.get(former.slug)
        if (formerBucket) formerBucket.push(named)
        else bySlug.set(former.slug, [named])
      }
    }

    for (const [slug, entities] of bySlug) {
      if (entities.length < 2) continue
      collisions.push({ file, slug, entities })
    }
  }

  return collisions
}
