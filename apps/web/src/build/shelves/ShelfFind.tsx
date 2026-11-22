/**
 * A shelf's find box (r5 D4): the Mechs and Patterns shelves, where twenty
 * builds of one chassis differ by a number in the name, keep the lines whose
 * name, chassis, pattern or description holds what is typed. It stands atop
 * its list (ledger.md L10's bar) once there are two lines to tell apart.
 */
import type { ReactNode } from 'react'
import { useState } from 'react'
import { SearchField } from '../../components/index'

/** Whether any of a line's words holds the query, cased or not; a blank query keeps every line. */
export function findMatches(
  query: string,
  words: readonly (string | number | undefined)[]
): boolean {
  const wanted = query.trim().toLowerCase()
  if (wanted === '') return true
  return words.some((word) => word !== undefined && String(word).toLowerCase().includes(wanted))
}

/** The query and its field; no field for a shelf of fewer than two lines. */
export function useShelfFind(label: string, lines: number): { query: string; field: ReactNode } {
  const [query, setQuery] = useState('')
  const field =
    lines < 2 ? undefined : (
      <SearchField
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder={label}
        aria-label={label}
        autoComplete="off"
      />
    )
  return { query: lines < 2 ? '' : query, field }
}
