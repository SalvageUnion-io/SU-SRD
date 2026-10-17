/**
 * The product's names, spelled once. Every surface that names the tools — the
 * apps' titles and copy, the OG cards, the Union bar's lockup and the Discord
 * bot's replies — imports these rather than typing its own spelling, so the
 * name cannot drift between screens again.
 *
 * - `name` — the character builder & game manager, in copy and titles.
 * - `shortName` — its short form, for the installed app's home-screen label.
 * - `descriptor` — what it is, said plainly, wherever the name is introduced
 *   (the front door's eyebrow; the manifest and meta descriptions spell it as
 *   text).
 * - `tagline` — the old name's banner line, kept as the legacy tagline, and
 *   `taglineBy`, who it is quoted from.
 * - `wordmark` — the site's own name, as the reference OG card draws it.
 *
 * Dependency-free on purpose: the Discord bot Worker and Convex import it as
 * `cantina-domain/product` without pulling in React, and the UI library's OG
 * card draws it too.
 */
export declare const PRODUCT: {
    readonly name: 'The Cantina';
    readonly shortName: 'Cantina';
    readonly descriptor: 'The Salvage Union Character Builder';
    readonly tagline: 'You’re in The Union, now!';
    readonly taglineBy: 'Lester “Stumpy” Owens';
    readonly wordmark: 'salvageunion.io';
};
