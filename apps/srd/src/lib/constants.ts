// Re-exported, not re-declared. This origin was hardcoded in four places
// (here, itun's deep-link builder, and twice inside the Discord bot); the
// dataset owns it now, beside ASSET_BASE_URL, so a domain change is one edit.
export { SRD_SITE_URL as SITE_URL } from 'salvageunion-reference'

/**
 * In The Union Now — the companion character builder & game manager, served
 * beside the SRD at salvageunion.io/build (ADR-048). Absolute, so a link built
 * from it reads the same in llms.txt, a Discord embed or the dev server.
 */
export const ITUN_URL = 'https://salvageunion.io/build/'

/**
 * The SURef Discord bot's install link. The client id is public by design —
 * it appears in every Discord invite URL; the bot authenticates with its
 * token, never this id. It asks for no server permissions.
 */
export const DISCORD_INSTALL_URL =
  'https://discord.com/oauth2/authorize?client_id=1442878052823470172&scope=bot%20applications.commands&permissions=0'

/** Default OG image path — the 1200×630 branded card. */
export const DEFAULT_OG_IMAGE = '/og-image.png'

/**
 * Every page title but the home page's ends in this. Search results show ~60
 * characters, and the old ` - Salvage Union System Reference Document` spent 42
 * of them on the suffix, so long entity names were cut off.
 */
export const TITLE_SUFFIX = ' · Salvage Union SRD'

/** Meta descriptions are cut to this, ellipsis included: about what a search snippet shows. */
export const META_DESCRIPTION_MAX = 155

/**
 * The browser-chrome colour every BaseLayout page emits as `theme-color`. It
 * must equal `theme_color` in `public/site.webmanifest`, which only an
 * installed PWA reads; `constants.test.ts` holds the two together.
 */
export const THEME_COLOR = '#1b1712' // design-tokens-ignore: --color-ink-deep, spelled as the manifest spells it

/**
 * The site's own pages, which left the Union bar when the SRD dropped its second
 * nav row (ruleset §3.11, origin v60): the bar carries the switcher, the search
 * and the trail, and these four live in the shared `Footer`.
 */
export const SITE_LINKS = [
  { label: 'Changelog', href: '/changelog/' },
  { label: 'API', href: '/api/' },
  { label: 'Discord', href: '/discord/' },
  { label: 'About', href: '/about/' },
] as const
