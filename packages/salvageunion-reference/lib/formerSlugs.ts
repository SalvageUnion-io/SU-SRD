/**
 * Former slugs — ADR-043, decision 4: a published slug never dies. A row whose
 * slug must go lists the old one, and every surface that takes a slug resolves
 * it to where the thing lives now (srd answers it with a 301).
 *
 * The one case in the data is a Bio-Titan that became a PATTERN of another:
 * "Hill Worm Pattern Typhon" was published as its own Bio-Titan at
 * `bio-titans/hill-worm-pattern-typhon` before it became Typhon's "Hill Worm"
 * pattern. So a former slug lives on the pattern (`formerSlugs`), is scoped to
 * its host's schema, and resolves to the host plus the pattern.
 *
 * The package barrel (`lib/index.ts`) re-exports the names consumers use.
 */

import { getModel } from './helpers'
import { getLoadedModelBySchemaId } from './ModelFactory'
import { getPatterns } from './patterns'
import type {
  SURefEntity,
  SURefEnumSchemaName,
  SURefMetaEntity,
  SURefObjectAnyPattern,
} from './schemas/index'

/** A slug no row carries any more, and the pattern it now names. */
export type FormerSlug = {
  /** The retired slug, unique within `host`'s schema. */
  slug: string
  /** The entity the pattern belongs to. */
  host: SURefEntity
  pattern: SURefObjectAnyPattern
}

/**
 * Every former slug in one schema. Only visible patterns count: a hidden
 * pattern has no page to send anyone to.
 */
export function formerSlugsIn(schemaName: SURefEnumSchemaName | string): FormerSlug[] {
  // Only a loaded schema: an unloaded one has no rows to have retired a slug.
  if (!getLoadedModelBySchemaId(schemaName)) return []
  const found: FormerSlug[] = []
  for (const row of getModel(schemaName)?.all() ?? []) {
    for (const pattern of getPatterns(row as SURefMetaEntity) ?? []) {
      if (!('formerSlugs' in pattern) || !pattern.formerSlugs) continue
      for (const slug of pattern.formerSlugs) found.push({ slug, host: row, pattern })
    }
  }
  return found
}

/**
 * Where a retired slug points now, or null. Call it only after a live lookup
 * (`findEntityBySlug`) misses: a live row always wins, and the slug check keeps
 * a former slug from ever shadowing one.
 */
export function resolveFormerSlug(
  schemaName: SURefEnumSchemaName | string,
  slug: string
): FormerSlug | null {
  return formerSlugsIn(schemaName).find((entry) => entry.slug === slug) ?? null
}
