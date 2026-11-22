/**
 * A name filter that forgives what the site search forgives (r4 E14): every
 * word typed is in the name, or, from four letters, one slip from one of its
 * words ("lazer" finds a Laser, "ralgun" the Railgun). The search's own
 * matcher (`matchSearchTokens`), read against the name alone.
 */

import { matchSearchTokens, searchNameWords } from 'salvageunion-reference'

export function nameMatches(name: string, query: string): boolean {
  const tokens = query.toLowerCase().split(/\s+/).filter(Boolean)
  if (tokens.length === 0) return true
  const lowered = name.toLowerCase()
  return matchSearchTokens(tokens, searchNameWords(lowered), (token) => lowered.includes(token))
    .matches
}
