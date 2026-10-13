/**
 * The Salvage Union terms a chat message names — what "Look up in Salvage
 * Union" (the message context menu) answers with.
 *
 * Matching is by the names the book prints, longest first, so "Reactor
 * Overload" wins over "Reactor". A roll-table row's label counts too ("Reactor
 * Overheat" finds the Reactor Overload table, at its 11–19), because players
 * quote results, not table names.
 *
 * A single word must be capitalised as the book capitalises a game term
 * ("Vulnerable"): chat is full of ordinary words that are also glossary
 * entries ("cover", "hot", "range"), and a lookup that answers every one of
 * them is noise. A name of two words or more is distinctive enough to match in
 * any case.
 */

import type { SURefEntity } from 'salvageunion-reference'
import { getDataMaps, getSchemaCatalog, isSchemaName, toEntityModel } from 'salvageunion-reference'
import type { LookupHit } from './lookupCard'

/** A term found in a message: the entry, the words that named it, and the row a label matched. */
export type FoundTerm = { hit: LookupHit; matched: string; row?: string }

/** The longest name, in words, worth trying. */
const MAX_WORDS = 6

/** The most terms one answer lists. */
const MAX_TERMS = 5

type IndexEntry = { hit: LookupHit; row?: string }

let index: Map<string, IndexEntry> | null = null

/** Every entry's name, and every roll-table row label, lower-cased. Built once. */
function termIndex(): Map<string, IndexEntry> {
  if (index) return index
  const built = new Map<string, IndexEntry>()
  const { dataMap } = getDataMaps()
  const labels: [string, IndexEntry][] = []
  for (const schema of getSchemaCatalog().schemas) {
    if (schema.meta || !isSchemaName(schema.id)) continue
    const schemaName = schema.id
    for (const entity of (dataMap[schemaName] as SURefEntity[] | undefined) ?? []) {
      const hit: LookupHit = { schemaName, entity: { ...entity, schemaName } }
      const name = 'name' in entity && typeof entity.name === 'string' ? entity.name : ''
      if (name && !built.has(name.toLowerCase())) built.set(name.toLowerCase(), { hit })
      if (schemaName === 'roll-tables') {
        const table = toEntityModel(hit.entity).table
        for (const row of table?.kind === 'bands' ? table.rows : []) {
          if (row.label) labels.push([row.label.toLowerCase(), { hit, row: row.key }])
        }
      }
    }
  }
  // A name always beats a row label that happens to read the same.
  for (const [label, entry] of labels) if (!built.has(label)) built.set(label, entry)
  index = built
  return built
}

/** Words with their place in the text; a hyphen or apostrophe stays inside a word. */
function wordsOf(text: string): { word: string; start: number; end: number }[] {
  return [...text.matchAll(/[\p{L}\p{N}]+(?:['’-][\p{L}\p{N}]+)*/gu)].map((match) => ({
    word: match[0],
    start: match.index ?? 0,
    end: (match.index ?? 0) + match[0].length,
  }))
}

const capitalised = (word: string): boolean => /^\p{Lu}/u.test(word)

/** The terms a message names, in the order it names them, each once. */
export function findTerms(text: string, max = MAX_TERMS): FoundTerm[] {
  const terms = termIndex()
  const words = wordsOf(text)
  const found: FoundTerm[] = []
  const seen = new Set<string>()
  let i = 0
  while (i < words.length && found.length < max) {
    let advanced = false
    for (let length = Math.min(MAX_WORDS, words.length - i); length >= 1; length--) {
      const span = words.slice(i, i + length)
      const first = span[0]
      if (!first) break
      if (length === 1 && (!capitalised(first.word) || first.word.length < 3)) continue
      const key = span.map((w) => w.word.toLowerCase()).join(' ')
      const entry = terms.get(key)
      if (!entry) continue
      const id = `${entry.hit.schemaName}::${entry.hit.entity.id}`
      if (!seen.has(id)) {
        seen.add(id)
        found.push({
          hit: entry.hit,
          matched: span.map((w) => w.word).join(' '),
          ...(entry.row ? { row: entry.row } : {}),
        })
      }
      i += length
      advanced = true
      break
    }
    if (!advanced) i++
  }
  return found
}
