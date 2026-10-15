import type { EntityRef } from 'salvageunion-reference'

/**
 * PAGE REFERENCES — the book's own cross-references ("roll on the Reactor
 * Overload Table p. 235", "see p. 249"), drawn as links to the SRD page that
 * covers that Workshop Manual page, where one does.
 *
 * The rules text cites pages, not entities, and a page holds several entities,
 * so a reference is resolved from the words before it:
 *
 * 1. an entity printed on that page whose NAME the prose just used — "the
 *    Welding Laser System (see p. 172)" is the Welding Laser, not the three
 *    other systems on p. 172. A name the prose follows with its kind's noun
 *    ("… Ability", "… Table") wins over a same-named entity of another kind;
 * 2. else the one guide that STARTS on that page ("Full details on The Union
 *    Crawler can be found on p. 212" is the Create a Crawler guide);
 * 3. else nothing: the reference stays text. A page the SRD has no single
 *    answer for is never guessed.
 *
 * The candidates are the app's to supply (`EntitySurfaceValue.pageRefs`): the
 * SRD builds them at build time for just the pages an entity cites, so the
 * client needs no extra schema to resolve them, and an app that supplies none
 * (The Cantina) prints every reference as the book does.
 */

/** One entity printed on a Workshop Manual page. */
export type PageRefCandidate = {
  ref: EntityRef
  /** Its kind's noun, lower case ("ability", "roll table"). */
  noun: string
  /** A guide: the page is where it starts. */
  guide?: boolean
}

/** Workshop Manual page → the entities printed on it. */
export type PageRefIndex = Record<number, PageRefCandidate[]>

/** A `p. N` in a run of prose. */
export type PageRefMatch = { start: number; end: number; page: number }

/** How far back the prose is searched for the name a reference points at. */
const LOOKBACK = 120

/**
 * Every `p. N` (or `p.N`) in `text`. Bounded quantifiers only, so it cannot
 * backtrack; a word ending in "p" ("step.") never matches, by the boundary.
 */
export function findPageRefs(text: string): PageRefMatch[] {
  const matches: PageRefMatch[] = []
  for (const m of text.matchAll(/\bp\.\s?(\d{1,3})\b/g)) {
    matches.push({ start: m.index, end: m.index + m[0].length, page: Number(m[1]) })
  }
  return matches
}

/** The last word of a noun: "roll table" is cited as "… Table". */
const lastWord = (noun: string) => noun.slice(noun.lastIndexOf(' ') + 1)

const isWordChar = (ch: string | undefined) =>
  ch !== undefined && ((ch >= 'a' && ch <= 'z') || (ch >= '0' && ch <= '9'))

/**
 * Where `word` last occurs in `text` as a whole word ("Mount" is not in
 * "amount"), or -1. Both are lower case.
 */
function lastWholeWord(text: string, word: string): number {
  let at = text.lastIndexOf(word)
  while (at !== -1) {
    if (!isWordChar(text[at - 1]) && !isWordChar(text[at + word.length])) return at
    at = at === 0 ? -1 : text.lastIndexOf(word, at - 1)
  }
  return -1
}

/** Lexicographic: the first differing place decides. */
function outranks(a: readonly number[], b: readonly number[]): boolean {
  for (let i = 0; i < a.length; i++) {
    if ((a[i] ?? 0) !== (b[i] ?? 0)) return (a[i] ?? 0) > (b[i] ?? 0)
  }
  return false
}

/**
 * The entity a `p. N` points at, from the prose before it — or `undefined`.
 * See the module comment for the order.
 */
export function resolvePageRef(
  index: PageRefIndex,
  page: number,
  before: string
): EntityRef | undefined {
  const candidates = index[page]
  if (!candidates || candidates.length === 0) return undefined

  // Ranked by where the name ends (the nearest wins), then whether the prose
  // follows it with its kind's noun, then by length (the longer name is the
  // more specific one).
  const prose = before.slice(-LOOKBACK).toLowerCase()
  let best: { candidate: PageRefCandidate; rank: [number, number, number] } | undefined
  for (const candidate of candidates) {
    const name = candidate.ref.name.toLowerCase()
    const at = lastWholeWord(prose, name)
    if (at === -1) continue
    const after = prose.slice(at + name.length).trimStart()
    const named = after.startsWith(candidate.noun) || after.startsWith(lastWord(candidate.noun))
    const rank: [number, number, number] = [at + name.length, named ? 1 : 0, name.length]
    if (!best || outranks(rank, best.rank)) best = { candidate, rank }
  }
  if (best) return best.candidate.ref

  const guides = candidates.filter((candidate) => candidate.guide)
  return guides.length === 1 ? guides[0]?.ref : undefined
}
