/**
 * A sheet's stat labels explain themselves (r4 E21): HP, AP, SP, EP, Heat,
 * SYS, MODS and an item's Cost open the glossary entry a Reference tile opens
 * (its keyword, with its page cite), and Training Points, Inventory and Cargo,
 * which the glossary has no entry for, their meaning in the app's words over
 * the book's page (`statTerms`).
 * Provided to the sheet's atoms through `StatMeaningContext` (`StatMeanings`).
 */

import type { ReactNode } from 'react'
import { getEntitySlug, SalvageUnionReference } from 'salvageunion-reference'
import { readReference } from '../../lib/readReference'
import { StatMeaningContext } from '../atoms/statMeaning'
import { ChipLink, statTerm, TermChip } from '../entity'

/** A stat's key on a sheet, and the keyword that defines it. */
const KEYWORDS: Readonly<Record<string, string>> = {
  hp: 'hit-points',
  ap: 'ability-points',
  sp: 'structure-points',
  ep: 'energy-points',
  heat: 'heat',
  // A chassis's cost, on the mech wizard's chassis legend (r6 F3).
  sv: 'salvage-value',
  // A mech's slot budgets, and an item's EP cost (r5 C8).
  systemSlots: 'system-slots',
  moduleSlots: 'module-slots',
  cost: 'energy-points',
}

/** A stat's key on a sheet, and the term's (`statTerms`) where they differ. */
const TERMS: Readonly<Record<string, string>> = { tp: 'training-points' }

/** One stat label as the control that opens its definition, outside a sheet: the chassis legend's (r6 F3). */
export function StatMeaning({ statKey, children }: { statKey: string; children: ReactNode }) {
  const slug = KEYWORDS[statKey]
  const entry = slug
    ? readReference(
        'statMeaning.keyword',
        () =>
          SalvageUnionReference.isLoaded('keywords')
            ? SalvageUnionReference.Keywords.getBySlug(slug)
            : undefined,
        undefined
      )
    : undefined
  if (entry) {
    const ref = {
      schemaName: 'keywords' as const,
      id: entry.id,
      slug: getEntitySlug(entry),
      name: entry.name,
    }
    return (
      <ChipLink tag={{ key: statKey, name: entry.name, ref }} linkable>
        {children}
      </ChipLink>
    )
  }
  const term = statTerm({ key: TERMS[statKey] ?? statKey })
  return term ? <TermChip term={term}>{children}</TermChip> : children
}

const meaning = (key: string, label: ReactNode): ReactNode => (
  <StatMeaning statKey={key}>{label}</StatMeaning>
)

/** A sheet whose stat labels explain themselves: `StatMeaningContext`'s provider. */
export function StatMeanings({ children }: { children: ReactNode }) {
  return <StatMeaningContext.Provider value={meaning}>{children}</StatMeaningContext.Provider>
}
