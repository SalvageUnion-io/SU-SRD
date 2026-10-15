/**
 * The public pages search may list: the front door, the Starter Set and each
 * of its builds. Every one is the same for every visitor and needs no account
 * (ADR-021: signed-out surfaces), and none is a player's own thing, so the
 * Worker knows what each says without asking Convex.
 *
 * For a crawler's request (no `Sec-Fetch-Mode: navigate`, as for a shared
 * thing's unfurl, `index.ts` rule 2) the shell's `cantina:meta` block carries the
 * page's own title, description, canonical and `og:*`; the front door keeps the
 * shell's defaults and gains only its canonical. `/sitemap.xml` lists the same
 * pages, and the SRD's `sitemap-index.xml` points at it.
 *
 * Every URL is built from the request's origin and the app's base, so a Worker
 * Preview names only itself, as `linkPreview.ts` does.
 *
 * The picture is the app's own `og-image.png`: the render surfaces
 * (`/og/:kind/:id`) read Convex's public answer, which a Starter Set template
 * never has.
 */

import { color } from 'component-lib/design/tokens'
import { PRODUCT } from 'component-lib/product'
import type { StarterKind, StarterPage } from '../lib/starterSet/starterTemplates'
import {
  isStarterKind,
  STARTER_SET_ADVENTURE,
  STARTER_SET_PUBLISHER,
  STARTER_SET_TITLE,
  starterPage,
  starterPages,
} from '../lib/starterSet/starterTemplates'
import type { ShellMeta } from './shellMeta'

/** A public page: its canonical path inside the app, and its words (none keeps the shell's). */
export type PublicPage = {
  path: string
  words: Pick<ShellMeta, 'title' | 'description' | 'themeColor'> | null
}

const FRONT_DOOR: PublicPage = { path: '/', words: null }

const STARTER_SET: PublicPage = {
  path: '/starter',
  words: {
    title: STARTER_SET_TITLE,
    description: `The Salvage Union Starter Set's pre-generated crew from ${STARTER_SET_ADVENTURE}, by ${STARTER_SET_PUBLISHER}: six Pilots, their Mechs and the Union Crawler they call home. Read every sheet free; copy one to play.`,
    themeColor: color.crawlerBand,
  },
}

/** The band each kind's sheet wears, as its unfurl's side bar. */
const TONE: Record<StarterKind, string> = {
  pilot: color.pilot,
  mech: color.mech,
  crawler: color.crawlerBand,
}

function fromStarter(page: StarterPage, kind: StarterKind): PublicPage {
  return {
    path: page.path,
    words: { title: page.title, description: page.description, themeColor: TONE[kind] },
  }
}

/** The public page a path inside the app names, or null. A trailing slash names the same page. */
export function publicPageOf(path: string): PublicPage | null {
  if (path === '/') return FRONT_DOOR
  const trimmed = path.replace(/\/+$/, '')
  if (trimmed === '/starter') return STARTER_SET
  const parts = trimmed.split('/')
  if (parts.length !== 4 || parts[1] !== 'starter') return null
  const [, , kind = '', id = ''] = parts
  if (!isStarterKind(kind)) return null
  const page = starterPage(kind, id)
  return page === null ? null : fromStarter(page, kind)
}

/** Every public page's path inside the app: the front door, the Starter Set, then each build. */
function publicPaths(): string[] {
  return [FRONT_DOOR.path, STARTER_SET.path, ...starterPages().map((page) => page.path)]
}

/** `origin` + base + an app path: the address a canonical and the sitemap name. */
export function publicUrl(origin: string, base: string, path: string): string {
  return `${origin}${base}${path}`
}

/** The shell's meta block for a page with words of its own; the picture is the app's own. */
export function publicMeta(
  page: PublicPage & { words: NonNullable<PublicPage['words']> },
  origin: string,
  base: string
): ShellMeta {
  const url = publicUrl(origin, base, page.path)
  return {
    ...page.words,
    url,
    canonical: url,
    image: { url: `${origin}${base}/og-image.png`, alt: PRODUCT.name },
  }
}

/** `/sitemap.xml`, inside the app's base. */
export const SITEMAP_PATH = '/sitemap.xml'

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

/** The public pages' urlset. */
export function sitemap(origin: string, base: string): Response {
  const entries = publicPaths()
    .map((path) => `<url><loc>${escapeXml(publicUrl(origin, base, path))}</loc></url>`)
    .join('')
  const body = `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${entries}</urlset>`
  return new Response(body, {
    headers: {
      'content-type': 'application/xml; charset=utf-8',
      'cache-control': 'public, max-age=3600',
    },
  })
}
