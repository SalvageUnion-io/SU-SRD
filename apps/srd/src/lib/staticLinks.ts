/**
 * Build-time resolution of a `[[Name]]` in rules text to the glossary entry it
 * names: a trait, else a keyword. Used where the page is drawn from data at
 * build time and the island that mounts it must read none (the roll-table
 * page's bands, the static no-JS fallback): the ref is resolved here, and the
 * Mention draws it — its page from `srdHrefFor`, its Peek from its address.
 */
import type { EntityRef } from 'salvageunion-reference'
import { getEntitySlug, SalvageUnionReference } from 'salvageunion-reference'

export function resolveMentionRef(name: string): EntityRef | null {
  const target = name.toLowerCase()
  const trait = SalvageUnionReference.Traits.all().find((t) => t.name.toLowerCase() === target)
  if (trait) {
    return { schemaName: 'traits', id: trait.id, slug: getEntitySlug(trait), name: trait.name }
  }
  const keyword = SalvageUnionReference.Keywords.all().find((k) => k.name.toLowerCase() === target)
  if (keyword) {
    return {
      schemaName: 'keywords',
      id: keyword.id,
      slug: getEntitySlug(keyword),
      name: keyword.name,
    }
  }
  return null
}
