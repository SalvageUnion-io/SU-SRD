import { componentsCopy } from '../../../messages/components'
import { entityCopy } from '../../../messages/components-entity'

/**
 * A stat the glossary has no entry for, defined in the app's own words with
 * the page the book explains it on (E27): a chip or a tile that names it
 * opens this, where a hover `title` says nothing on a phone. A stat the
 * glossary does define links to its entry instead (`factRef`).
 */
export type StatTerm = {
  /** Its address under `TERM_SCHEMA`: `term:cargo-capacity`. */
  key: string
  name: string
  text: string
  /** `Workshop Manual · p.97`. */
  cite: string
}

/** The Peek address space of a term: no dataset schema, so nothing loads. */
export const TERM_SCHEMA = 'term'

const cite = (page: number) => componentsCopy('workshopManualP', { page })

const TERMS: readonly (StatTerm & { names: RegExp })[] = [
  {
    key: 'cargo-capacity',
    names: /cargo ?capacity$/i,
    name: entityCopy('termCargoCapacity'),
    text: entityCopy('termCargoCapacityIs'),
    cite: cite(97),
  },
  {
    key: 'slots-required',
    names: /slots ?required$/i,
    name: entityCopy('termSlotsRequired'),
    text: entityCopy('termSlotsRequiredIs'),
    cite: cite(97),
  },
  {
    key: 'damage',
    names: /^damage$/i,
    name: entityCopy('termDamage'),
    text: entityCopy('termDamageIs'),
    cite: cite(241),
  },
  {
    key: 'training-points',
    names: /^training-points$/i,
    name: entityCopy('termTrainingPoints'),
    text: entityCopy('termTrainingPointsIs'),
    cite: cite(23),
  },
  {
    key: 'inventory',
    names: /^inventory$/i,
    name: entityCopy('termInventory'),
    text: entityCopy('termInventoryIs'),
    cite: cite(20),
  },
]

/** The term a fact's key names (a book stat's is `book-<its name>`), or none. */
export function statTerm(fact: { key: string }): StatTerm | undefined {
  return TERMS.find((term) => term.names.test(fact.key))
}

/** The term at a Peek address's id, or none. */
export function termAt(key: string): StatTerm | undefined {
  return TERMS.find((term) => term.key === key)
}

/** What a class's training costs are counted in. */
export const TRAINING_POINTS = TERMS[3] as StatTerm

/** A term's Peek address: `term:<key>`. */
export function termPeekAddress(term: StatTerm): string {
  return `${TERM_SCHEMA}:${term.key}`
}
