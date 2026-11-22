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

/**
 * True when `token` is one slip from `word`: one character dropped, added or
 * changed (a double letter one short or one over is that: "chasis",
 * "hackker"), or two neighbours swapped ("exlposive", "hackre"). The typo
 * forgiveness both matchers and the kinds' own names share.
 */
export function searchOneSlipAway(token: string, word: string): boolean {
  if (withinEditDistance1(token, word)) return true
  if (token.length !== word.length) return false
  let i = 0
  while (i < token.length && token[i] === word[i]) i++
  return (
    i < token.length - 1 &&
    token[i] === word[i + 1] &&
    token[i + 1] === word[i] &&
    token.slice(i + 2) === word.slice(i + 2)
  )
}

/** Minimum token length before typo (one-slip) matching applies. */
const TYPO_MIN_TOKEN_LENGTH = 4

/** A typo-assisted match loses this much, which puts it under every literal hit. */
const TYPO_PENALTY = 15

/**
 * A typo of the whole name ("heet" → Heat): 15 once the penalty is off, under
 * the lowest literal name tier (20) and over a hit in the prose alone.
 */
const TYPO_NAME_SCORE = 30

/**
 * A normalised query: its words, and the same words as one string. A question's
 * filler ("how does salvaging work") is left out of both, and a whole question
 * ("what happens when my mech hits 0 sp") is cut back to its key words;
 * `rawQuery` is the query as typed, set only when something was left out.
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

/** How a question opens: with one of these, a query of several words is read as a question. */
const QUESTION_OPENERS = new Set([
  'are',
  'can',
  'could',
  'do',
  'does',
  'how',
  'if',
  'is',
  'should',
  'what',
  'when',
  'where',
  'which',
  'who',
  'why',
  'will',
])

/** A question is this many words or more: "what is heat" is still a name with filler. */
const QUESTION_MIN_WORDS = 4

/**
 * The words a whole question spends on asking ("what HAPPENS when my mech
 * HITS 0 sp"): dropped from a question alone, since several are a rule's own
 * words in a short query ("hit points", "get up").
 */
const QUESTION_WORDS = new Set([
  'am',
  'at',
  'be',
  'been',
  'by',
  'did',
  'from',
  'get',
  'gets',
  'go',
  'goes',
  'happen',
  'happens',
  'has',
  'have',
  'hit',
  'hits',
  'if',
  'into',
  'me',
  'mean',
  'means',
  'much',
  'reach',
  'reaches',
  'should',
  'that',
  'there',
  'this',
  'was',
  'we',
  'who',
  'will',
  'with',
  'would',
])

const SENTENCE_MARKS = '?!,;:'

/** A word without the sentence marks it ends on. A loop, not a pattern: a pattern backtracks on a long run of marks. */
function withoutSentenceMarks(word: string): string {
  let end = word.length
  while (end > 0 && SENTENCE_MARKS.includes(word[end - 1] as string)) end--
  return word.slice(0, end)
}

/** Normalise a raw query, or `null` when it is blank (a blank query matches nothing). */
export function tokenizeSearchQuery(query: string): SearchQuery | null {
  const rawQuery = query.trim().toLowerCase()
  if (!rawQuery) return null
  const words = rawQuery.split(/\s+/)
  // A whole question is cut back to the words that name something.
  const question =
    words.length >= QUESTION_MIN_WORDS &&
    (rawQuery.endsWith('?') || QUESTION_OPENERS.has(words[0] as string))
  // A question mark or a comma is the sentence's, not the word's.
  const named = words
    .map(withoutSentenceMarks)
    .filter((word) => word && !FILLER_WORDS.has(word) && !(question && QUESTION_WORDS.has(word)))
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
 * the sheets print it, a table by its famous result, and the phrases players
 * say at the table ("long range", "who goes first"). By the name of the
 * entity it finds; a whole query equal to one ranks just under an exact name,
 * so the page it names leads. Search's own list: never a field of the game data.
 */
const ALIASES_AS_PRINTED: Readonly<Record<string, readonly string[]>> = {
  'Ability Points': ['AP'],
  // The range bands, as they are said.
  Close: ['close range', 'range bands'],
  'Core Mechanic': ['nat 20', 'natural 20', 'nat 1', 'natural 1', 'd20'],
  'Crawler Downtime': ['TP', 'Training Points'],
  'Energy Points': ['EP'],
  Far: ['far range', 'range bands'],
  'Group Initiative': ['initiative', 'turn order', 'who goes first'],
  'Hit Points': ['HP'],
  Long: ['long range', 'range bands'],
  'Mech Damage': ['my mech hits 0 SP'],
  Medium: ['medium range', 'range bands'],
  'Multi-attack': ['can I shoot twice'],
  Range: ['range bands'],
  'Salvage Value': ['SV'],
  'Structure Points': ['SP'],
  'Tech Level': ['TL'],
  // A rule with no entry of its own: the site's index gives it a row (`searchIndexBuild`).
  'Training Points': ['TP'],
  'Turn action': ['can I shoot twice'],
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
 * A phrase cut back to the words that name something, as a whole question
 * is: "my mech hits 0 sp" and "what happens when my mech hits 0 sp" are both
 * "mech 0 sp". A phrase that keeps fewer than two such words is compared as
 * it is typed ("who goes first" keeps only "first").
 */
function spokenKey(text: string): string {
  const named = text
    .split(/\s+/)
    .map(withoutSentenceMarks)
    .filter((word) => word && !FILLER_WORDS.has(word) && !QUESTION_WORDS.has(word))
  return named.length >= 2 ? named.join(' ') : ''
}

/** Whether one of the queries is an alias of this name, as typed or as a phrase's key words. */
function saysAlias(nameText: string, queries: readonly string[]): boolean {
  const aliases = searchAliases(nameText)
  if (aliases.length === 0) return false
  if (queries.some((q) => aliases.includes(q) || aliases.includes(withoutSentenceMarks(q)))) {
    return true
  }
  const keys = new Set(queries.map(spokenKey).filter(Boolean))
  return keys.size > 0 && aliases.some((alias) => keys.has(spokenKey(alias)))
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
 * for a token of {@link TYPO_MIN_TOKEN_LENGTH}+ characters, be one slip away
 * ({@link searchOneSlipAway}) from a word of the NAME ("hellfyre" → "Hellfire"). Typo forgiveness is
 * name-only on purpose: fuzzy-matching prose turns every query into noise.
 */
export function matchSearchTokens(
  tokens: readonly string[],
  nameWords: readonly string[],
  hasLiteral: (token: string) => boolean
): { matches: boolean; usedTypo: boolean } {
  let usedTypo = false
  // A number after the whole name is the name's value as a weapon prints it
  // ("hot 3" for Hot): the entry's text is not asked for it.
  const named =
    nameWords.length > 0 && nameWords.every((word, i) => tokens[i] === word) ? nameWords.length : -1
  for (const [i, token] of tokens.entries()) {
    if (hasLiteral(token)) continue
    if (named >= 0 && i >= named && isNumber(token)) continue
    // Another form of the word ("salvaging" for "salvage").
    const stem = searchWordStem(token)
    if (stem !== token && hasLiteral(stem)) continue
    if (
      token.length >= TYPO_MIN_TOKEN_LENGTH &&
      nameWords.some((word) => searchOneSlipAway(token, word))
    ) {
      usedTypo = true
      continue
    }
    return { matches: false, usedTypo: false }
  }
  return { matches: true, usedTypo }
}

/** A token that is a number and nothing else. */
function isNumber(token: string): boolean {
  return token !== '' && [...token].every((ch) => ch >= '0' && ch <= '9')
}

/**
 * The name, then more words ("mule sp", "hot 3"): the thing named leads the
 * looser hits. Under an exact name and its looser readings, over a prefix.
 */
const NAME_THEN_WORDS_SCORE = 80

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
  /**
   * A roll table printed inside another entry (`embeddedRollTableNames`): it
   * ranks one point under what its owner earns, never ahead as a rule.
   */
  embedded?: boolean
}

/** A token as a name word, literally or one slip away. */
function slipsTo(token: string, word: string): boolean {
  return token.length >= TYPO_MIN_TOKEN_LENGTH ? searchOneSlipAway(token, word) : token === word
}

/**
 * What a typo-assisted match earns from the name: the query is the whole
 * name, word for word, each as typed or one slip away. A slip in one word of
 * a longer name earns nothing, so it stays under every literal hit.
 */
function typoNameScore(tokens: readonly string[], nameText: string): number {
  const words = searchNameWords(nameText)
  const whole =
    tokens.length === words.length && tokens.every((t, i) => slipsTo(t, words[i] as string))
  return whole ? TYPO_NAME_SCORE : 0
}

/** The edits between two words, neighbours swapped counting one; `limit + 1` once past the limit. */
function slipDistance(a: string, b: string, limit: number): number {
  if (Math.abs(a.length - b.length) > limit) return limit + 1
  let before: number[] = []
  let row = Array.from({ length: b.length + 1 }, (_, j) => j)
  for (let i = 1; i <= a.length; i++) {
    const next = [i]
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      let best = Math.min(
        (row[j] as number) + 1,
        (next[j - 1] as number) + 1,
        (row[j - 1] as number) + cost
      )
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        best = Math.min(best, (before[j - 2] as number) + 1)
      }
      next.push(best)
    }
    before = row
    row = next
  }
  return Math.min(row[b.length] as number, limit + 1)
}

/** A word this long may be two slips from the name it meant; a shorter one, one. */
const TWO_SLIPS_MIN_LENGTH = 6

/**
 * "Did you mean": the query with each word no name holds put right from the
 * names' own words, or `null` when every word is known or none is close. The
 * caller offers it only if it finds something.
 */
export function suggestSearchQuery(query: string, names: readonly string[]): string | null {
  const parsed = tokenizeSearchQuery(query)
  if (!parsed) return null
  const vocabulary = new Set<string>()
  for (const name of names) {
    for (const word of searchNameWords(name.toLowerCase())) vocabulary.add(word)
  }
  let changed = false
  const words = parsed.tokens.map((token) => {
    if (token.length < TYPO_MIN_TOKEN_LENGTH) return token
    if (vocabulary.has(token) || vocabulary.has(searchWordStem(token))) return token
    const limit = token.length >= TWO_SLIPS_MIN_LENGTH ? 2 : 1
    let best: string | undefined
    let bestDistance = limit + 1
    for (const word of vocabulary) {
      if (word.length < TYPO_MIN_TOKEN_LENGTH) continue
      const distance = slipDistance(token, word, limit)
      // On a tie, the word that opens as the typed one does.
      const closer =
        distance < bestDistance ||
        (distance === bestDistance &&
          distance <= limit &&
          word[0] === token[0] &&
          best?.[0] !== token[0])
      if (closer) {
        best = word
        bestDistance = distance
      }
    }
    if (best === undefined) return token
    changed = true
    return best
  })
  return changed ? words.join(' ') : null
}

/**
 * The relevance score of a hit. Higher ranks first.
 *
 * Name-priority tiers, first that applies: exact name 100, name prefix 50,
 * whole query inside the name 25, every token inside the name ("heavy laser" →
 * "Heavy Arc Laser") 20. Then the ORM-only refinements, which a caller without
 * per-field data simply omits: +10 for the whole query in the description, +5
 * per matched field. A typo-assisted match loses 15; before that a typo of
 * the whole name earns 30, so a slipped name ("heet" → Heat) ranks under
 * every literal name tier and over a hit in the prose alone ("sheet").
 *
 * The name tiers are tried on the query as typed and on it without a
 * question's filler. Under them, the looser readings of a name: the query is
 * one of the entity's aliases 90 ("sp" → Structure Points), the name without
 * its punctuation 85 ("biotitan" → Bio-Titan), another form of the name's
 * words 20 ("overheating" → Overheat). The rules' own kinds add a few points
 * (`RULES_KIND_BOOST`). The name with more words after it 80 ("mule sp"); a
 * roll table printed inside another entry, one under its owner.
 */
export function scoreSearchMatch(facts: SearchMatchFacts): number {
  const { nameText, loweredQuery, tokens } = facts
  const queries = facts.rawQuery ? [facts.rawQuery, loweredQuery] : [loweredQuery]
  let score = 0

  if (queries.some((q) => nameText === q)) score += 100
  else if (saysAlias(nameText, queries)) score += 90
  else if (searchSquashedName(nameText) === searchSquashedName(loweredQuery)) score += 85
  else if (queries.some((q) => q.startsWith(`${nameText} `))) score += NAME_THEN_WORDS_SCORE
  else if (queries.some((q) => nameText.startsWith(q))) score += 50
  else if (queries.some((q) => nameText.includes(q))) score += 25
  else if (tokens.every((t) => nameText.includes(t) || nameText.includes(searchWordStem(t))))
    score += 20
  else if (facts.usedTypo) score += typoNameScore(tokens, nameText)

  score += facts.embedded ? -1 : (RULES_KIND_BOOST[facts.schemaName ?? ''] ?? 0)

  if (facts.descriptionText?.includes(loweredQuery)) score += 10
  score += (facts.matchedFieldCount ?? 0) * 5

  if (facts.usedTypo) score -= TYPO_PENALTY
  return score
}
