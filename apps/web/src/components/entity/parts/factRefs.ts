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
 * The stats the glossary defines, by how a fact's key ends (a book stat's is
 * `book-<its name>`), each with its keyword's slug. A stat with no entry
 * (Cargo Capacity, Slots Required) names none.
 */
const STAT_KEYWORDS: readonly [RegExp, string][] = [
  [/salvage ?value$/i, 'salvage-value'],
  [/structure ?points$/i, 'structure-points'],
  [/energy ?points$/i, 'energy-points'],
  [/hit ?points$/i, 'hit-points'],
  [/system ?slots$/i, 'system-slots'],
  [/module ?slots$/i, 'module-slots'],
  [/heat ?capacity$/i, 'heat'],
]

/** A keyword by its slug, as a ref; none where keywords are not loaded. */
function keywordRef(slug: string): EntityRef | undefined {
  if (!SalvageUnionReference.isLoaded('keywords')) return undefined
  const entry = SalvageUnionReference.Keywords.getBySlug(slug)
  return entry
    ? { schemaName: 'keywords', id: entry.id, slug: getEntitySlug(entry), name: entry.name }
    : undefined
}

/**
 * The rule a band's fact chip names, so it links as a trait does: a Tech
 * Level its tech level's page (`TL | 4` → Tech 4), a range its distance
 * (`RNG | Long`), a stat the glossary defines (Salvage Value, Structure
 * Points, Energy Points, Hit Points, System and Module Slots, Heat Capacity)
 * its keyword. Any other fact only reads.
 */
export function factRef(fact: { key: string; value: unknown }): EntityRef | undefined {
  const value = fact.value === undefined ? '' : String(fact.value).trim()
  if (!value) return undefined
  if (fact.key === RANK_KEY)
    return /^\d+$/.test(value) ? entryRef('tech-levels', `Tech ${value}`) : undefined
  if (fact.key === 'range') return entryRef('distances', value)
  // "Bio-Salvage Value" is its own stat with no entry of its own name: it
  // reads Salvage Value's, as it always has.
  const slug = STAT_KEYWORDS.find(([ends]) => ends.test(fact.key))?.[1]
  return slug ? keywordRef(slug) : undefined
}

/** An action type's keyword (`Turn Action`, `Reaction`, `Passive`): what its chip links to. */
export function actionTypeRef(name: string): EntityRef | undefined {
  return glossaryRef('keywords', name)
}
