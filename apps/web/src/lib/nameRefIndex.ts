/**
 * Build-time name references for the SRD's pages. The index itself, every
 * entry by its name and which kind a shared name means, is the package's
 * (`nameRefIndex`, salvageunion-reference), which the bot's term lookup reads
 * too, so the two resolve a name alike. Here: the index a page's prose
 * renders against (less the page's own name), and the part of it an island
 * carries (`nameRefsFor`), so the browser resolves a name without loading
 * another schema.
 */

import type { NameRefIndex, RefEntity } from 'salvageunion-reference'
import { nameRefIndex } from 'salvageunion-reference'
import { findNameRefs } from '../components/index'

const perEntity = new Map<string, NameRefIndex>()

/** The whole index less `id`'s own name: an entity's prose never links its own page. */
export function nameRefIndexWithout(id: string | undefined): NameRefIndex {
  const { index } = nameRefIndex()
  if (!id) return index
  const known = perEntity.get(id)
  if (known) return known
  const own = Object.entries(index).filter(([, candidates]) =>
    candidates.some((candidate) => candidate.ref.id === id)
  )
  if (own.length === 0) return index
  // Its own name in its own prose is itself, never a namesake ("If the Trading
  // Bay becomes damaged" is the bay), unless its noun says so ("roll on the
  // Trading Bay Table" is the table).
  const without: NameRefIndex = { ...index }
  for (const [key, candidates] of own) {
    const namesakes = candidates
      .filter((candidate) => candidate.ref.id !== id && candidate.noun)
      .map((candidate) => ({ ...candidate, needsNoun: true }))
    if (namesakes.length > 0) without[key] = namesakes
    else delete without[key]
  }
  perEntity.set(id, without)
  return without
}

/**
 * The part of `index` that `texts` use: what an island needs to resolve the
 * same names in the browser, or `undefined` when they name nothing.
 */
function nameRefSubset(index: NameRefIndex, texts: readonly string[]): NameRefIndex | undefined {
  const used = new Set<string>()
  for (const text of texts) {
    for (const match of findNameRefs(text, index)) used.add(match.ref.name.trim().toLowerCase())
  }
  if (used.size === 0) return undefined
  return Object.fromEntries([...used].flatMap((key) => (index[key] ? [[key, index[key]]] : [])))
}

/** Every string a record holds, for the names its prose may use. */
function proseOf(value: unknown, into: string[] = []): string[] {
  if (typeof value === 'string') into.push(value)
  else if (Array.isArray(value)) for (const item of value) proseOf(item, into)
  else if (value && typeof value === 'object') {
    for (const item of Object.values(value)) proseOf(item, into)
  }
  return into
}

/**
 * The names an island's card resolves in the browser: those its own record's
 * prose and the card's rendered `text` use (the card also draws what it
 * carries: a class's ability tree, a chassis's patterns), less itself.
 */
export function nameRefsFor(
  item: RefEntity,
  text: readonly string[] = []
): NameRefIndex | undefined {
  return nameRefSubset(nameRefIndexWithout(item.id), [...proseOf(item), ...text])
}
