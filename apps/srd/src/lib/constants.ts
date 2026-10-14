// The production origin is the dataset's, beside ASSET_BASE_URL, so a domain
// change is one edit; this build's own origin is read from its environment.
import { SRD_SITE_URL } from 'salvageunion-reference'

/** An origin from the build's environment, without a trailing slash; `fallback` when unset. */
function originOr(value: string | undefined, fallback: string): string {
  return (value || fallback).replace(/\/+$/, '')
}

/**
 * Where this build is served, and every absolute link to a page of it:
 * production's `SRD_SITE_URL`, or a Worker Preview's origin, which
 * `deploy-preview.yml` passes as `VITE_SRD_ORIGIN`. Canonicals, `og:` tags, the
 * Discord Component Embed, structured data, the sitemap and llms.txt all follow
 * it, so a Preview names only itself. A Preview answers `noindex`, so its
 * canonicals are never indexed.
 */
export const SITE_URL = originOr(import.meta.env.VITE_SRD_ORIGIN, SRD_SITE_URL)

/** Every breadcrumb trail's root: the home page is the book's Contents, on
 *  every page that has a trail (never "Home" on some and "Contents" on others). */
export const CONTENTS_CRUMB = { name: 'Contents', url: `${SITE_URL}/` } as const

/**
 * In The Union Now — the companion character builder & game manager, served
 * beside the SRD at salvageunion.io/build (ADR-048). Absolute, so a link built
 * from it reads the same in llms.txt, a Discord embed or the dev server. A
 * Worker Preview's build links its own ITUN Preview (`VITE_ITUN_ORIGIN`).
 */
export const ITUN_URL = `${originOr(import.meta.env.VITE_ITUN_ORIGIN, SRD_SITE_URL)}/build/`

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
