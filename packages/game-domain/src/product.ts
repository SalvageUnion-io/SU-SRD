/**
 * The product's names, spelled once. Every surface that names the tools — the
 * app's titles and copy, the OG cards, the front door and the Discord bot's
 * replies — imports these rather than typing its own spelling, so a name
 * cannot drift between screens again.
 *
 * The site has three areas, the header's nouns (ADR-066): Reference, the
 * Training Bay and Games. Two of them carry a name on their pages:
 *
 * - `build` — the Training Bay, the bay where a pilot trains (the book's VR
 *   Tubes call it a Training Bay): everything you own, built and kept, each
 *   unit on one page whose modes are Read | Edit | Play.
 * - `play` — Games: the tables you run or sit at, their crews and invites.
 *
 * The Training Bay is also a crawler bay in the SRD; the reference pages and
 * search keep treating that entry as a bay. The whole app has no name of its own: copy
 * says "the app", or the site's `wordmark` where a proper noun is needed (the
 * account is a salvageunion.io account).
 *
 * - `descriptor` — what Build is, said plainly, wherever its name is
 *   introduced (the front door's eyebrow); `playDescriptor` the same for
 *   Games (the Games hub's eyebrow).
 * - `tagline` — the old name's banner line, kept as the legacy tagline, and
 *   `taglineBy`, who it is quoted from.
 * - `wordmark` — the site's own name, as the reference OG card draws it.
 *
 * Dependency-free on purpose: the Discord bot Worker and the site Worker import it as
 * `game-domain/product` without pulling in React, and the UI library's OG
 * card draws it too.
 */
export const PRODUCT = {
  build: 'Training Bay',
  play: 'Games',
  descriptor: 'The Salvage Union Character Builder',
  playDescriptor: 'The Salvage Union Table Manager',
  tagline: 'You’re in The Union, now!',
  taglineBy: 'Lester “Stumpy” Owens',
  wordmark: 'salvageunion.io',
} as const
