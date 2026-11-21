import type { EntityRef } from 'salvageunion-reference'
import { getEntitySlug, glossaryRef, SalvageUnionReference } from 'salvageunion-reference'
import { RANK_KEY } from './chipSet'

/** A dataset entry by its exact name, as a ref; none where it is not loaded. */
function entryRef(schemaName: 'tech-levels' | 'distances', name: string): EntityRef | undefined {
  if (!SalvageUnionReference.isLoaded(schemaName)) return undefined
  const entry = SalvageUnionReference.getByNameIn(schemaName, name)
  return entry
    ? { schemaName, id: entry.id, slug: getEntitySlug(entry), name: entry.name }
    : undefined
}

/**
 * The rule a band's fact chip names, so it links as a trait does: a Tech
 * Level its tech level's page (`TL | 4` → Tech 4), a range its distance
 * (`RNG | Long`), Salvage Value its keyword. Any other fact only reads.
 */
export function factRef(fact: { key: string; value: unknown }): EntityRef | undefined {
  const value = fact.value === undefined ? '' : String(fact.value).trim()
  if (!value) return undefined
  if (fact.key === RANK_KEY)
    return /^\d+$/.test(value) ? entryRef('tech-levels', `Tech ${value}`) : undefined
  if (fact.key === 'range') return entryRef('distances', value)
  if (/salvage ?value$/i.test(fact.key)) return glossaryRef('keywords', 'Salvage value')
  return undefined
}

/** An action type's keyword (`Turn Action`, `Reaction`, `Passive`): what its chip links to. */
export function actionTypeRef(name: string): EntityRef | undefined {
  return glossaryRef('keywords', name)
}
