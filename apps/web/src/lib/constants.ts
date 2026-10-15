// The production origin is the dataset's, beside ASSET_BASE_URL, so a domain
// change is one edit; this build's own origin is read from its environment.
import { SRD_SITE_URL } from 'salvageunion-reference'
import { SITE } from './site'

/**
 * Where this build is served, and every absolute link to a page of it:
 * production's `SRD_SITE_URL`, or a Worker Preview's origin, which
 * `deploy-preview.yml` passes as `VITE_SITE_ORIGIN` (the dev server sets its
 * own, `ssg/dev.ts`). Canonicals, `og:` tags, the
 * Discord Component Embed, structured data, the sitemap and llms.txt all follow
 * it, so a Preview names only itself. A Preview answers `noindex`, so its
 * canonicals are never indexed.
 */
export const SITE_URL = (import.meta.env.VITE_SITE_ORIGIN || SRD_SITE_URL).replace(/\/+$/, '')

/** Every breadcrumb trail's root: the home page is the book's Contents, on
 *  every page that has a trail (never "Home" on some and "Contents" on others). */
export const CONTENTS_CRUMB = { name: 'Contents', url: `${SITE_URL}/` } as const

/**
 * The Cantina — the companion character builder & game manager, served on
 * this origin at /build (ADR-048). Root-relative: a link built from it opens
 * the Cantina beside whichever SRD served the page, production, a Worker
 * Preview or the dev server. Prefix `SITE_URL` where an address must be
 * absolute (the sitemap). The base itself is `SITE.base` (`site.ts`).
 */
export const CANTINA_PATH = SITE.base

/**
 * The SalvageUnion.io Discord bot's install link. The client id is public by design —
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

/** Search results cut a title at about this many characters. */
export const TITLE_MAX = 65

/**
 * An entity page's title: `Name - Kind · Salvage Union SRD`, shedding the kind
 * and then the suffix when that runs past {@link TITLE_MAX}, so a long name
 * (most are roll tables) reads whole in search results instead of being cut.
 */
export function entityTitle(name: string, kind: string): string {
  const full = `${name} - ${kind}${TITLE_SUFFIX}`
  if (full.length <= TITLE_MAX) return full
  const named = `${name}${TITLE_SUFFIX}`
  return named.length <= TITLE_MAX ? named : name
}

/** Meta descriptions are cut to this, ellipsis included: about what a search snippet shows. */
export const META_DESCRIPTION_MAX = 155

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
