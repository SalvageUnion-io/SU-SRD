/**
 * Build-time resolution of trait/keyword names to SRD item URLs.
 * Used by the static (no-JS / crawler) entity fallback, where data is fully
 * loaded during the Astro build.
 */
import { SalvageUnionReference, getEntitySlug } from 'salvageunion-reference'

export function resolveTraitHref(traitName: string): string | null {
  const trait = SalvageUnionReference.Traits.all().find(
    (t) => t.name.toLowerCase() === traitName.toLowerCase()
  )
  if (trait) return `/schema/traits/item/${getEntitySlug(trait)}/`
  const keyword = SalvageUnionReference.Keywords.all().find(
    (k) => k.name.toLowerCase() === traitName.toLowerCase()
  )
  if (keyword) return `/schema/keywords/item/${getEntitySlug(keyword)}/`
  return null
}
