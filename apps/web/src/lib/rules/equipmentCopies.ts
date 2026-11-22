/**
 * Each copy of a piece of equipment keeps its own condition (r6 E16): two
 * Improvised Melee Weapons, one Damaged, one Intact. `equipment` lists slugs,
 * so a copy is a slug and its place among that slug's repeats (1, 2, …).
 *
 * The stored map stays keyed by slug for an item carried once. Carried more
 * than once, its copies are keyed `slug#1`, `slug#2`… An older record whose
 * copies share the one `slug` key reads that condition for each copy, and the
 * first change writes every copy its own key: the pair is split, each keeping
 * the condition it showed.
 */
import type { ItemCondition, ItemConditionMap } from 'game-domain/schemas/itemCondition'

/** A copy's key in the map: the slug alone for an item carried once. */
const copyKey = (slug: string, copy: number, count: number): string =>
  count > 1 ? `${slug}#${copy}` : slug

/** Whether the map already keeps this slug's copies apart. */
const split = (conditions: ItemConditionMap, slug: string): boolean =>
  Object.keys(conditions).some((key) => key.startsWith(`${slug}#`))

/** The condition copy `copy` (1-based) of `count` is in. */
export function copyCondition(
  conditions: ItemConditionMap | undefined,
  slug: string,
  copy: number,
  count: number
): ItemCondition {
  const map = conditions ?? {}
  if (count > 1 && split(map, slug)) return map[copyKey(slug, copy, count)] ?? 'intact'
  return map[slug] ?? 'intact'
}

/** The map with copy `copy` of `count` set to `next`, and every other copy as it reads now. */
export function withCopyCondition(
  conditions: ItemConditionMap | undefined,
  slug: string,
  copy: number,
  count: number,
  next: ItemCondition
): ItemConditionMap {
  const map = { ...(conditions ?? {}) }
  if (count <= 1) return { ...map, [slug]: next }
  const each = Array.from({ length: count }, (_, at) =>
    at + 1 === copy ? next : copyCondition(conditions, slug, at + 1, count)
  )
  delete map[slug]
  each.forEach((condition, at) => {
    map[copyKey(slug, at + 1, count)] = condition
  })
  return map
}

/** Each slug of a list with its copy number and how many of it the list holds. */
export function copiesOf(
  slugs: readonly string[]
): { slug: string; copy: number; count: number }[] {
  const seen = new Map<string, number>()
  return slugs.map((slug) => {
    const copy = (seen.get(slug) ?? 0) + 1
    seen.set(slug, copy)
    return { slug, copy, count: slugs.filter((other) => other === slug).length }
  })
}
