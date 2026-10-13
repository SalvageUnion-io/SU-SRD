/**
 * The verdicts the prose-deviation allowlist (`proseDeviations.ts`) hands out
 * by itself, before any fuzzy match against a book: a printed-name ruling, an
 * authored roll-table lead, and boilerplate. Book-free, so it is tested
 * without the gitignored rules extract; `check-rules-fidelity.ts` applies it
 * to a string the books did not match as written.
 */
import {
  AUTHORED_LEADS,
  BOILERPLATE_MIN_REPEATS,
  NAME_DEVIATIONS,
  OWNER_SUFFIX,
} from 'salvageunion-reference/proseDeviations'
import type { LockEntry, ProseItem } from './proseFidelity'

const PRINTED_NAMES = new Set(NAME_DEVIATIONS.map((d) => d.name))
const AUTHORED_LEAD_KEYS = new Set(AUTHORED_LEADS.map((d) => `${d.name}\n${d.text}`))

/** A string's ruling, or `undefined`; `repeats` is how often its text occurs in the dataset. */
export function ruling(
  item: Pick<ProseItem, 'kind' | 'file' | 'entityName' | 'text'>,
  repeats: number
): Omit<LockEntry, 'hash'> | undefined {
  const suffixBase = item.text.match(OWNER_SUFFIX)?.[1]
  if (item.kind === 'name')
    return PRINTED_NAMES.has(item.text) || (suffixBase && PRINTED_NAMES.has(suffixBase))
      ? { verdict: 'deviation', reason: 'printed-name' }
      : undefined
  if (
    item.file === 'roll-tables.json' &&
    AUTHORED_LEAD_KEYS.has(`${item.entityName}\n${item.text}`)
  )
    return { verdict: 'authored', reason: 'authored-lead' }
  if (repeats >= BOILERPLATE_MIN_REPEATS) return { verdict: 'authored', reason: 'boilerplate' }
  return undefined
}
