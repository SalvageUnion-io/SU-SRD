import { SITE_NAME } from './documentHead'
import { pageTitle } from './pageTitle'
import { originOf } from './site'

/**
 * Where this build is served, and every absolute link to a page of it:
 * production's origin (`site.ts`), or a Worker Preview's, which
 * `deploy-preview.yml` passes as `VITE_SITE_ORIGIN` (the dev server sets its
 * own, `ssg/dev.ts`). Canonicals, `og:` tags, the
 * Discord Component Embed, structured data, the sitemap and llms.txt all follow
 * it, so a Preview names only itself. A Preview answers `noindex`, so its
 * canonicals are never indexed.
 */
export const SITE_URL = originOf(import.meta.env.VITE_SITE_ORIGIN)

/** The site's description: the home page's, and any page's that sets none. */
export const DEFAULT_DESCRIPTION =
  'The rules reference and character manager for the Salvage Union TTRPG: every chassis, system, module and ability, and the app to run Pilots, Mechs and Crawlers.'

/** The site in structured data: the home page's WebSite, and what every other page is part of. */
export const WEBSITE = { '@type': 'WebSite', name: SITE_NAME, url: `${SITE_URL}/` } as const

/** The game's publisher in structured data: the books' author, the listings' creator. */
export const PUBLISHER = { '@type': 'Organization', name: 'Leyline Press' } as const

/** Every trail's first crumb: the SRD's home page. */
export const SRD_CRUMB = { name: 'Reference', url: `${SITE_URL}/` } as const

/**
 * The SalvageUnion.io Discord bot's install link. The client id is public by design —
 * it appears in every Discord invite URL; the bot authenticates with its
 * token, never this id. It asks for no server permissions.
 */
export const DISCORD_INSTALL_URL =
  'https://discord.com/oauth2/authorize?client_id=1442878052823470172&scope=bot%20applications.commands&permissions=0'

/** Default OG image path — the 1200×630 branded card. */
export const DEFAULT_OG_IMAGE = '/og-image.png'

/** Search results cut a title at about this many characters. */
export const TITLE_MAX = 65

/**
 * An entity page's title: `Name - Kind · SalvageUnion.io` (`pageTitle`),
 * shedding the kind and then the suffix when that runs past {@link TITLE_MAX},
 * so a long name (most are roll tables) reads whole in search results instead
 * of being cut.
 */
export function entityTitle(name: string, kind: string): string {
  const full = pageTitle(`${name} - ${kind}`)
  if (full.length <= TITLE_MAX) return full
  const named = pageTitle(name)
  return named.length <= TITLE_MAX ? named : name
}

/** Meta descriptions are cut to this, ellipsis included: about what a search snippet shows. */
export const META_DESCRIPTION_MAX = 155
