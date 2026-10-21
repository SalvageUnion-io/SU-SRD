import { createContext } from 'react'
import type { EntityRef } from 'salvageunion-reference'

/**
 * NAME REFERENCES — the entities rules text names in plain words ("This
 * Chassis gains the Dependable Trait", "re-roll results on the Critical Damage
 * Table", "within Close Range"), drawn as Mentions where they resolve.
 *
 * The book capitalises its game terms, so a name is found only where the prose
 * prints it capitalised ("Dependable", never "a dependable build"), as a whole
 * word, its last word optionally plural ("Heat Checks"). A name the prose
 * follows with its kind's noun ("… Trait", "… Table", "… Range") is that
 * kind's entry; the link is the name alone ("Dependable", not "Dependable
 * Trait") but for a table, whose noun joins it ("the Critical Damage Table"); otherwise the first candidate the
 * index lists wins (the builder orders them, `lib/nameRefIndex.ts`). Some
 * kinds link only with their noun (`needsNoun`: a one-word ability or table,
 * whose bare word is too often plain English), a range also after its
 * preposition ("within Close").
 *
 * A one-word name opening a sentence is left alone ("Repair a Mech"), and each
 * entry links once per run of prose: its first mention.
 *
 * The index is the app's to supply (`EntitySurfaceValue.nameRefs`): the SRD
 * builds it at build time, the whole dataset on the server and just the names a
 * page uses for its island, so the browser resolves a name without loading
 * another schema. An app that supplies none prints the prose as the book does.
 */

/**
 * The entity whose prose renders below (its id): a contentful Mini sets it (a
 * page's own card is held by its index, `nameRefIndexWithout`), so its own
 * name in its own text links nothing, and a namesake only by its noun ("If the
 * Trading Bay becomes damaged" is the bay; "the Trading Bay Table" its table).
 */
export const ProseOwnerContext = createContext<string | undefined>(undefined)

/** One entry a name in prose may mean. */
export type NameRefCandidate = {
  ref: EntityRef
  /** The noun the prose follows this kind's name with ("Trait", "Table"). */
  noun?: string
  /** The noun joins the link: a table is "the Critical Damage Table". */
  nounInLink?: boolean
  /** Links only followed by its noun. */
  needsNoun?: boolean
  /** A range: links followed by its noun or after a preposition ("within Close"). */
  range?: boolean
}

/** Name (lower case) → the entries it may mean, the default first. */
export type NameRefIndex = Record<string, NameRefCandidate[]>

/** A name found in a run of prose and the entry it means. */
export type NameRefMatch = { start: number; end: number; ref: EntityRef }

/** What may sit before a range's bare name ("within Close"). */
const RANGE_PREPOSITION = /\b(within|to|at|of|from|beyond|outside|inside)\s+$/i

/** The book's capitalised nouns for game things, which a term may stand beside. */
const GAME_NOUNS = new Set([
  'system',
  'systems',
  'module',
  'modules',
  'chassis',
  'mech',
  'mechs',
  'pilot',
  'pilots',
  'crawler',
  'crawlers',
  'vehicle',
  'vehicles',
  'drone',
  'drones',
  'equipment',
  'trait',
  'traits',
  'table',
  'range',
  'ability',
  'abilities',
  'action',
  'actions',
  'weapon',
  'weapons',
  'bay',
  'scrap',
  'check',
  'checks',
  'condition',
])

/** Words a lower-case glossary name keeps lower case in the book's prose. */
const SMALL_WORDS = new Set(['a', 'an', 'and', 'of', 'or', 'the', 'to', 'in', 'on', '/'])

/** A letter or digit, in any script: what a name's word is made of. */
const isWordChar = (ch: string | undefined) => ch !== undefined && /[\p{L}\p{N}]/u.test(ch)

/** Joins words into one ("Anti-Mech", "Mech's" is still "Mech"). */
const isJoiner = (ch: string | undefined) => ch === '-'

const isUpper = (ch: string | undefined) =>
  ch !== undefined && ch !== ch.toLowerCase() && ch === ch.toUpperCase()

/**
 * The name's leading punctuation (".50 Cal") and its first word as the prose
 * tokenises it ("A.I. Personality" starts "a").
 */
function firstWord(name: string): { lead: number; word: string } {
  let lead = 0
  while (lead < name.length && !isWordChar(name[lead])) lead++
  const word = /^[\p{L}\p{N}][\p{L}\p{N}'’-]*/u.exec(name.slice(lead))?.[0] ?? ''
  return { lead, word }
}

type Lookup = Map<string, { key: string; lead: number }[]>

const lookups = new WeakMap<NameRefIndex, Lookup>()

/** The index's names by their first word, longest name first (built once per index). */
function lookupFor(index: NameRefIndex): Lookup {
  const known = lookups.get(index)
  if (known) return known
  const lookup: Lookup = new Map()
  for (const key of Object.keys(index).sort((a, b) => b.length - a.length)) {
    const { lead, word } = firstWord(key)
    if (!word) continue
    const list = lookup.get(word) ?? []
    list.push({ key, lead })
    lookup.set(word, list)
  }
  lookups.set(index, lookup)
  return lookup
}

/**
 * Whether the prose prints the name as the book prints a game term: each word
 * capitalised where the name's is, and every word of a lower-case glossary
 * name ("heat check" is printed "Heat Check") but its small words.
 */
function printedAsTerm(text: string, start: number, key: string, name: string): boolean {
  const glossary = name === name.toLowerCase()
  const words = key.split(' ')
  const named = name.split(' ')
  let at = start
  for (let i = 0; i < words.length; i++) {
    const word = words[i] ?? ''
    const own = named[i] ?? word
    let first = 0
    while (first < word.length && !isWordChar(word[first])) first++
    const letter = own[first]
    if (letter !== undefined && /\p{L}/u.test(letter)) {
      const wanted = glossary ? !SMALL_WORDS.has(word) : isUpper(letter)
      if (wanted && !isUpper(text[at + first])) return false
    }
    at += word.length + 1
  }
  return true
}

/** Where a name's last word ends, taking a plural ("Checks", "Mechs'"), or -1. */
function wordEnd(lower: string, end: number): number {
  const boundary = (at: number) => !isWordChar(lower[at]) && !isJoiner(lower[at])
  if (boundary(end)) return end
  if (lower[end] === 's' && boundary(end + 1)) return end + 1
  if (lower.startsWith('es', end) && boundary(end + 2)) return end + 2
  return -1
}

/** Whether a one-word name opens its sentence. */
function opensSentence(text: string, start: number): boolean {
  const before = text.slice(Math.max(0, start - 4), start).trimEnd()
  return before === '' || /[.!?:;•"“(]$/.test(before)
}

/**
 * Whether the words around a name make it part of a longer proper name that is
 * not an entry ("Evantis Heavy Industries", "the Second Corpo War", "Advanced
 * Hacking"): a capitalised word right after it, or right before it where that
 * word does not open the sentence. A game noun beside it is no proper name: "an
 * Intact System" is Intact.
 */
function insideProperName(text: string, start: number, end: number): boolean {
  const after = /^ ['‘’"“]?([\p{L}\p{N}-][\p{L}\p{N}'’-]*)/u.exec(text.slice(end, end + 40))?.[1]
  if (after && isUpper(after[0]) && !GAME_NOUNS.has(after.toLowerCase())) return true
  // A quoted designation ("the 'K4' Rifle") is a model number, not a name.
  const before = /([\p{L}\p{N}-][\p{L}\p{N}'’-]*?)['‘’"”]? $/u.exec(
    text.slice(Math.max(0, start - 40), start)
  )?.[1]
  if (!before || !isUpper(before[0]) || GAME_NOUNS.has(before.toLowerCase())) return false
  return !opensSentence(text, start - before.length - 1)
}

/** Where `noun` ends when the prose follows a name with it ("… Trait", "… Traits"), else -1. */
function nounAfter(text: string, end: number, noun: string): number {
  const match = /^ ([A-Za-z]+)/.exec(text.slice(end, end + noun.length + 4))
  const word = match?.[1]?.toLowerCase()
  const want = noun.toLowerCase()
  return word === want || word === `${want}s` ? end + 1 + word.length : -1
}

/** The match at `start` for `key`, or `undefined`. */
function matchAt(
  text: string,
  lower: string,
  start: number,
  key: string,
  candidates: readonly NameRefCandidate[],
  owner: string | undefined
): NameRefMatch | undefined {
  // The owner's own name names itself: a namesake links only with its noun
  // (on the Trading Bay, "the Trading Bay Table" is the table).
  const owned = !!owner && candidates.some((candidate) => candidate.ref.id === owner)
  const end = wordEnd(lower, start + key.length)
  if (end === -1) return undefined
  const name = candidates[0]?.ref.name ?? key
  if (!printedAsTerm(text, start, key, name)) return undefined

  // A name followed by a kind's noun is that kind's; the link is the name
  // alone, but for a kind whose noun is part of its name (`nounInLink`).
  for (const candidate of candidates) {
    if (candidate.ref.id === owner || !candidate.noun) continue
    const nounEnd = nounAfter(text, end, candidate.noun)
    if (nounEnd !== -1) {
      return { start, end: candidate.nounInLink ? nounEnd : end, ref: candidate.ref }
    }
  }
  if (owned) return undefined

  if (!key.includes(' ') && opensSentence(text, start)) return undefined
  if (insideProperName(text, start, end)) return undefined
  for (const candidate of candidates) {
    if (candidate.needsNoun) continue
    if (candidate.range && !RANGE_PREPOSITION.test(text.slice(Math.max(0, start - 12), start))) {
      continue
    }
    return { start, end, ref: candidate.ref }
  }
  return undefined
}

/**
 * Every name `index` holds that `text` prints as a term, outside the `skip`
 * spans (its `[[Trait]]` markup): leftmost first, the longest name winning an
 * overlap, each entry once, none the `owner`'s own name.
 */
export function findNameRefs(
  text: string,
  index: NameRefIndex,
  skip: readonly { start: number; end: number }[] = [],
  owner?: string
): NameRefMatch[] {
  const lookup = lookupFor(index)
  const lower = text.toLowerCase()
  const found: NameRefMatch[] = []
  const tokens = /[\p{L}\p{N}][\p{L}\p{N}'’-]*/gu
  for (const token of lower.matchAll(tokens)) {
    const at = token.index
    if (isWordChar(lower[at - 1]) || isJoiner(lower[at - 1])) continue
    const word = token[0]
    const words = new Set([word, word.replace(/['’]s$/, '')])
    for (const w of [...words]) {
      if (w.endsWith('es')) words.add(w.slice(0, -2))
      if (w.endsWith('s')) words.add(w.slice(0, -1))
    }
    for (const w of words) {
      for (const { key, lead } of lookup.get(w) ?? []) {
        const start = at - lead
        if (start < 0 || !lower.startsWith(key, start)) continue
        if (lead > 0 && isWordChar(lower[start - 1])) continue
        const candidates = index[key]
        if (!candidates) continue
        const match = matchAt(text, lower, start, key, candidates, owner)
        if (match) found.push(match)
      }
    }
  }

  found.sort((a, b) => a.start - b.start || b.end - a.end)
  const kept: NameRefMatch[] = []
  const seen = new Set<string>()
  let reach = 0
  for (const match of found) {
    if (match.start < reach) continue
    if (skip.some((span) => match.start < span.end && match.end > span.start)) continue
    reach = match.end
    const id = `${match.ref.schemaName}:${match.ref.id}`
    if (seen.has(id)) continue
    seen.add(id)
    kept.push(match)
  }
  return kept
}
