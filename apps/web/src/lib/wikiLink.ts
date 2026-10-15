/**
 * The Union bar's quiet "WIKI" link to the `/greembeem` easter egg, shown on
 * one page load in a hundred. The page serves it `hidden` (`WikiLink`) and the
 * client entry rolls once per load and reveals every copy together, so it
 * costs no React.
 */

/** One page load in this many shows the link. */
export const WIKI_LINK_ODDS = 100

/** The attribute that marks each copy of the link (desktop and phone clusters). */
export const WIKI_LINK_ATTRIBUTE = 'data-wiki-link'

/** Whether this page load shows the link: true one time in `WIKI_LINK_ODDS`. */
export function rollWikiLink(random: () => number = Math.random): boolean {
  return random() < 1 / WIKI_LINK_ODDS
}

/** Rolls once and, on a hit, reveals every copy of the link in `doc`. */
export function revealWikiLinks(doc: Document, random: () => number = Math.random): boolean {
  if (!rollWikiLink(random)) return false
  for (const link of doc.querySelectorAll<HTMLElement>(`[${WIKI_LINK_ATTRIBUTE}]`)) {
    link.hidden = false
  }
  return true
}
