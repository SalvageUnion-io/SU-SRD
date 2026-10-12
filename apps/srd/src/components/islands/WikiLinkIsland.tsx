import { FOCUS_RING } from 'component-lib'

/** One page load in this many shows the link. */
export const WIKI_LINK_ODDS = 100

/** Whether this page load shows the link: true one time in `WIKI_LINK_ODDS`. */
export function rollWikiLink(random: () => number = Math.random): boolean {
  return random() < 1 / WIKI_LINK_ODDS
}

/**
 * Rolled once per page load, at module scope: the bar mounts this island twice
 * (the desktop cluster and the phone one, one of them hidden at any width), and
 * both copies share this chunk, so they show or hide together.
 */
const shown = rollWikiLink()

/**
 * WikiLinkIsland — a quiet "WIKI" link in the Union bar that appears on one
 * page load in a hundred and leads to the `/greembeem` easter egg. Client-only
 * (`ssr={false}`): the roll is per page load, which a static page cannot make.
 */
export function WikiLinkIsland() {
  if (!shown) return null
  return (
    <a href="/greembeem" className={`su-union-bar__quiet ${FOCUS_RING}`}>
      WIKI
    </a>
  )
}
