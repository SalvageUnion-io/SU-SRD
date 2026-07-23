import type { PatternExternalLinkBuilder } from 'component-lib'
import { srdPatternHref } from '../../lib/patternHref'

/**
 * The SRD's "Pattern page →" foot-band link, supplied to component-lib via
 * `PatternExternalLinkProvider`.
 *
 * A pattern opens in a DIALOG when its row is clicked (it has no entity to
 * navigate to, and browsing a chassis's sixteen patterns shouldn't cost sixteen
 * page loads) — so this link is how a reader gets from that dialog to the
 * pattern's own shareable URL. Same tab: it's a page on this site, not a
 * cross-app deep link.
 */
export const srdPatternExternalLink: PatternExternalLinkBuilder = (chassis, pattern) => (
  <a
    href={srdPatternHref(chassis, pattern)}
    aria-label={`Open the ${pattern.name} pattern page`}
    className="underline decoration-1 underline-offset-2 transition-opacity hover:opacity-70"
  >
    Pattern page →
  </a>
)
