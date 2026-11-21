/**
 * Search matching and ranking — the pure half of search, shared by every
 * matcher in the repo.
 *
 * There are two matchers and there have to be: the ORM-backed `search()` in
 * `search.ts`, which walks the loaded entity corpus field by field, and the reference site's
 * `searchCompactIndex`, which runs in the browser against the build-time
 * `/search-index.json` so the site never ships the corpus. They differ in what
 * they match AGAINST. They must not differ in how a match is decided or ranked
 * — a result that sits first in one and fifth in the other is a bug nobody can
 * see from either side.
 *
 * So the rules live here, once: the query tokenisation, the AND-of-tokens rule
 * with its name-only typo forgiveness, and the name-priority score tiers. The reference site
 * calls {@link scoreSearchMatch} with the facts it has, and the ORM calls the same
 * function with the extra facts only it can know.
 *
 * Nothing in this module touches the ORM or the data, so importing it costs a
 * browser bundle nothing but these functions.
 */

/**
 * True when `token` is within edit distance 1 of `word` (insert, delete, or
 * substitute one character). Two-pointer scan — no DP table, O(len) time.
 *
 * The canonical typo-tolerance primitive, used through
 * {@link matchSearchTokens} by both matchers.
 */
function withinEditDistance1(token: string, word: string): boolean {
  const lenDiff = token.length - word.length
  if (lenDiff < -1 || lenDiff > 1) return false
  // Walk both strings past the common prefix, then compare the remainder
  // according to which edit (substitute / insert / delete) could reconcile.
  let i = 0
  while (i < token.length && i < word.length && token[i] === word[i]) i++
  if (i === token.length && i === word.length) return true // identical
  if (lenDiff === 0) return token.slice(i + 1) === word.slice(i + 1) // substitute
  if (lenDiff === 1) return token.slice(i + 1) === word.slice(i) // delete from token
  return token.slice(i) === word.slice(i + 1) // insert into token
}

/** Minimum token length before typo (edit-distance-1) matching applies. */
const TYPO_MIN_TOKEN_LENGTH = 4

/** A typo-assisted match always ranks below every literal hit. */
const TYPO_PENALTY = 15

/**
 * A normalised query: its words, and the same words as one string. A question's
 * filler ("how does salvaging work") is left out of both; `rawQuery` is the
 * query as typed, set only when something was left out.
 */
export type SearchQuery = { loweredQuery: string; tokens: string[]; rawQuery?: string }

/**
 * The words of a question that name nothing. They are dropped only while a
 * word that does name something is left ("the works" keeps both).
 */
const FILLER_WORDS = new Set([
  'a',
  'an',
  'and',
  'are',
  'can',
  'do',
  'does',
  'for',
  'how',
  'i',
  'in',
  'is',
  'it',
  'my',
  'of',
  'on',
  'the',
  'to',
  'what',
  'when',
  'where',
  'which',
  'why',
  'work',
  'works',
  'you',
  'your',
])

/** Normalise a raw query, or `null` when it is blank (a blank query matches nothing). */
export function tokenizeSearchQuery(query: string): SearchQuery | null {
  const rawQuery = query.trim().toLowerCase()
  if (!rawQuery) return null
  const words = rawQuery.split(/\s+/)
  // A question mark or a comma is the sentence's, not the word's.
  const named = words
    .map((word) => word.replace(/[?!,;:]+$/, ''))
    .filter((word) => word && !FILLER_WORDS.has(word))
  if (named.length === 0 || named.join(' ') === words.join(' ')) {
    return { loweredQuery: rawQuery, tokens: words }
  }
  return { loweredQuery: named.join(' '), tokens: named, rawQuery }
}

/** The shortest stem a word form is cut back to. */
const STEM_MIN_LENGTH = 4

/**
 * A word with its ending cut back, so one form finds another: "salvaging" and
 * "salvaged" find "salvage", "overheating" finds "Overheat", "abilities" finds
 * "ability". Matching is by substring, so the stem needs no ending put back.
 * A word too short to cut, or with no such ending, is returned as it is.
 */
export function searchWordStem(word: string): string {
  for (const ending of ['ing', 'ies', 'ed', 'es', 's']) {
    if (!word.endsWith(ending)) continue
    if (ending === 's' && word.endsWith('ss')) return word
    const stem = word.slice(0, -ending.length)
    if (stem.length >= STEM_MIN_LENGTH) return stem
  }
  return word
}

/** A name with nothing but its letters and digits: "bio-titan" as "biotitan". */
export function searchSquashedName(nameText: string): string {
  return nameText.replace(/[^a-z0-9]+/g, '')
}

/**
 * What a reader types for a rule other than its name: a stat's abbreviation as
 * the sheets print it, a table by its famous result. By the name of the
 * entity it finds; a whole query equal to one ranks just under an exact name.
 */
const ALIASES_AS_PRINTED: Readonly<Record<string, readonly string[]>> = {
  'Ability Points': ['AP'],
  'Core Mechanic': ['nat 20', 'natural 20', 'nat 1', 'natural 1', 'd20'],
  'Crawler Downtime': ['TP', 'Training Points'],
  'Energy Points': ['EP'],
  'Group Initiative': ['initiative', 'turn order'],
  'Hit Points': ['HP'],
  'Salvage Value': ['SV'],
  'Structure Points': ['SP'],
  'Tech Level': ['TL'],
}

/** `ALIASES_AS_PRINTED`, lowered: a query and a name are matched lowered. */
const SEARCH_ALIASES: Readonly<Record<string, readonly string[]>> = Object.fromEntries(
  Object.entries(ALIASES_AS_PRINTED).map(([name, aliases]) => [
    name.toLowerCase(),
    aliases.map((alias) => alias.toLowerCase()),
  ])
)

/** The aliases of the entity of this lowered name (`SEARCH_ALIASES`), or none. */
export function searchAliases(nameText: string): readonly string[] {
  return Object.hasOwn(SEARCH_ALIASES, nameText) ? (SEARCH_ALIASES[nameText] ?? []) : []
}

/**
 * The kinds that ARE the rules: on a query that matched prose alone ("turn
 * order", "combat") they come ahead of the hundreds of entities whose text
 * happens to hold the words. Smaller than every name tier.
 */
const RULES_KIND_BOOST: Readonly<Record<string, number>> = {
  guides: 4,
  keywords: 3,
  traits: 3,
  'roll-tables': 2,
}

/** The lowered name split into words — what typo forgiveness is measured against. */
export function searchNameWords(nameText: string): string[] {
  return nameText.split(/[^a-z0-9]+/).filter(Boolean)
}

/**
 * Does every token land? AND semantics: each token must either appear
 * literally (`hasLiteral` — the caller knows what it is matching against), or,
 * for a token of {@link TYPO_MIN_TOKEN_LENGTH}+ characters, be one edit away
 * from a word of the NAME ("hellfyre" → "Hellfire"). Typo forgiveness is
 * name-only on purpose: fuzzy-matching prose turns every query into noise.
 */
export function matchSearchTokens(
  tokens: readonly string[],
  nameWords: readonly string[],
  hasLiteral: (token: string) => boolean
): { matches: boolean; usedTypo: boolean } {
  let usedTypo = false
  for (const token of tokens) {
    if (hasLiteral(token)) continue
    // Another form of the word ("salvaging" for "salvage").
    const stem = searchWordStem(token)
    if (stem !== token && hasLiteral(stem)) continue
    if (
      token.length >= TYPO_MIN_TOKEN_LENGTH &&
      nameWords.some((word) => withinEditDistance1(token, word))
    ) {
      usedTypo = true
      continue
    }
    return { matches: false, usedTypo: false }
  }
  return { matches: true, usedTypo }
}

/** What a matcher knows about one hit. The optional facts are ORM-only. */
export type SearchMatchFacts = SearchQuery & {
  /** The entity name, lowered. */
  nameText: string
  /** Whether {@link matchSearchTokens} needed typo forgiveness. */
  usedTypo: boolean
  /** The entity description, lowered — a whole-query hit there earns +10. */
  descriptionText?: string
  /** How many distinct fields held a token — +5 each. */
  matchedFieldCount?: number
  /** The entity's schema: the rules' own kinds rank ahead on equal terms. */
  schemaName?: string
}

/**
 * The relevance score of a hit. Higher ranks first.
 *
 * Name-priority tiers, first that applies: exact name 100, name prefix 50,
 * whole query inside the name 25, every token inside the name ("heavy laser" →
 * "Heavy Arc Laser") 20. Then the ORM-only refinements, which a caller without
 * per-field data simply omits: +10 for the whole query in the description, +5
 * per matched field. A typo-assisted match loses 15, which keeps it below every
 * literal hit of the same tier.
 *
 * The name tiers are tried on the query as typed and on it without a
 * question's filler. Under them, the looser readings of a name: the query is
 * one of the entity's aliases 90 ("sp" → Structure Points), the name without
 * its punctuation 85 ("biotitan" → Bio-Titan), another form of the name's
 * words 20 ("overheating" → Overheat). The rules' own kinds add a few points
 * (`RULES_KIND_BOOST`).
 */
export function scoreSearchMatch(facts: SearchMatchFacts): number {
  const { nameText, loweredQuery, tokens } = facts
  const queries = facts.rawQuery ? [facts.rawQuery, loweredQuery] : [loweredQuery]
  let score = 0

  if (queries.some((q) => nameText === q)) score += 100
  else if (queries.some((q) => searchAliases(nameText).includes(q))) score += 90
  else if (searchSquashedName(nameText) === searchSquashedName(loweredQuery)) score += 85
  else if (queries.some((q) => nameText.startsWith(q))) score += 50
  else if (queries.some((q) => nameText.includes(q))) score += 25
  else if (tokens.every((t) => nameText.includes(t) || nameText.includes(searchWordStem(t))))
    score += 20

  score += RULES_KIND_BOOST[facts.schemaName ?? ''] ?? 0

  if (facts.descriptionText?.includes(loweredQuery)) score += 10
  score += (facts.matchedFieldCount ?? 0) * 5

  if (facts.usedTypo) score -= TYPO_PENALTY
  return score
}
