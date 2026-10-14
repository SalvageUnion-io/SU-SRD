/**
 * The product's names, spelled once. Every surface that names the tools — the
 * apps' titles and copy, the OG cards, the Union bar's lockup and the Discord
 * bot's replies — imports these rather than typing its own spelling, so the
 * name cannot drift between screens again.
 *
 * - `name` — the character builder & game manager, in copy and titles.
 * - `shortName` — its short form, fine in copy where space is tight.
 * - `wordmark` — the site's own name, as the reference OG card draws it.
 *
 * Dependency-free on purpose: the Discord bot Worker imports it through the
 * `component-lib/product` subpath without pulling in React.
 */
export const PRODUCT = {
  name: 'In the Union now',
  shortName: 'ITUN',
  wordmark: 'salvageunion.io',
} as const
