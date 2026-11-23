/**
 * A rules term asked about inside a phrase ("overheat" in "what happens when
 * my mech overheats", r7 E1): the half of search ranking that reads the whole
 * corpus's results, not one hit's. Both matchers call it the same way: when
 * no result names the whole query, each guide, keyword or trait whose name
 * the query holds is added or lifted to its term score.
 */

import type { SearchQuery } from './searchRanking'
import {
  RULES_KIND_BOOST,
  searchAliases,
  searchNameWords,
  searchWordForm,
  withoutSentenceMarks,
} from './searchRanking'

/** Whether `words` holds `run` as consecutive words. */
function holdsRun(words: readonly string[], run: readonly string[]): boolean {
  if (run.length === 0 || run.length > words.length) return false
  for (let i = 0; i + run.length <= words.length; i++) {
    if (run.every((word, j) => words[i + j] === word)) return true
  }
  return false
}

/**
 * The lowest literal name tier (`scoreSearchMatch`): a result at or over
 * it names the query.
 */
export const SEARCH_NAMES_IT = 20

/** The kinds a term asked about inside a phrase is: the rules' own words. */
const TERM_KINDS: ReadonlySet<string> = new Set(['guides', 'keywords', 'traits'])

/**
 * A term asked about inside a phrase ("overheat" in "what happens when my
 * mech overheats"): over every hit in the prose, under the name tiers that
 * name the whole query.
 */
const TERM_IN_QUERY_SCORE = 70

/** How much a term found in every entry loses: a common word ("mech") ranks under a rare one. */
const TERM_SHARE_WEIGHT = 10

/**
 * Whether the query holds this rules term (a guide's, keyword's or trait's
 * name, or one of its aliases) among its words, in any form of them:
 * "overheat" in "overheat mech", Map Movement in "how far can my mech move".
 * A matcher asks it only when no result names the whole query
 * ({@link SEARCH_NAMES_IT}), and ranks each term found with
 * {@link searchTermScore}: the rules term leads the prose that holds the
 * other words.
 */
export function searchNamesTerm(
  query: SearchQuery,
  nameText: string,
  schemaName?: string
): boolean {
  if (!TERM_KINDS.has(schemaName ?? '')) return false
  const said = (query.rawQuery ?? query.loweredQuery).split(/\s+/).map(withoutSentenceMarks)
  const forms = (words: readonly string[]) => words.map(searchWordForm)
  const name = forms(searchNameWords(nameText))
  if (holdsRun(forms(query.tokens.map(withoutSentenceMarks)), name) || holdsRun(forms(said), name))
    return true
  return searchAliases(nameText).some((alias) => holdsRun(said, alias.split(/\s+/)))
}

/**
 * A term's score ({@link searchNamesTerm}), by its kind and by `share`, the
 * part of the corpus (0 to 1) whose text holds its name: of two terms in one
 * question, the rarer is what is asked about ("overheat" before "mech").
 */
export function searchTermScore(schemaName: string, share: number): number {
  return TERM_IN_QUERY_SCORE + (RULES_KIND_BOOST[schemaName] ?? 0) - share * TERM_SHARE_WEIGHT
}
