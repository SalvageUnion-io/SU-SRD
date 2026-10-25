/**
 * The public pages search may list: the front door, the Starter Set and each
 * of its builds. Every one is the same for every visitor and needs no account
 * (ADR-021: signed-out surfaces), and none is a player's own thing, so what
 * each says is known without asking Convex.
 *
 * So the build pre-renders them (`publicShells`, from `astro/build/appPlugins.ts`):
 * the Starter Set and each build get a copy of the shell whose `app:meta`
 * block carries the page's own title, description, canonical and `og:*`,
 * written beside it as `starter.html` and `starter/<kind>/<id>.html`, which the
 * asset server answers for `/starter` and `/starter/<kind>/<id>`. The build also
 * writes `sitemap.xml` with the same pages; the SRD's `sitemap-index.xml` points
 * at it.
 *
 * The front door is the shell itself, which every other route is answered with
 * too, so it carries no canonical of its own: the Worker adds it for a crawler's
 * request (`app.ts`'s `share-preview` rule).
 *
 * Every URL is built from the deployment's origin (a Worker Preview's for its
 * build, the request's for the Worker) and the app's base, so a Preview names
 * only itself, as `linkPreview.ts` does.
 *
 * The picture is the site's own `/og-image.png`: the render surfaces
 * (`/og/:kind/:id`) read Convex's public answer, which a Starter Set template
 * never has.
 */

import type { SheetKind } from 'game-domain/entityKinds'
import { isSheetKind } from 'game-domain/entityKinds'
import { color } from '../design/tokens'
import { urlsetXml } from '../lib/sitemapXml'
import type { StarterPage } from '../lib/starterSet/starterTemplates'
import {
  STARTER_SET_ADVENTURE,
  STARTER_SET_PUBLISHER,
  STARTER_SET_TITLE,
  starterPages,
} from '../lib/starterSet/starterTemplates'
import type { ShellMeta } from './shellMeta'
import { applyCanonical, applyMeta } from './shellMeta'

/** A public page: its canonical path inside the app, and its own words. */
type PublicPage = {
  path: string
  words: Pick<ShellMeta, 'title' | 'description' | 'themeColor'>
}

/** The front door: the shell's own words. */
const FRONT_DOOR_PATH = '/'

const STARTER_SET: PublicPage = {
  path: '/starter',
  words: {
    title: STARTER_SET_TITLE,
    description: `The Salvage Union Starter Set crew from ${STARTER_SET_ADVENTURE}, by ${STARTER_SET_PUBLISHER}: six Pilots, their Mechs and their Union Crawler. Read every sheet free; copy one to play.`,
    themeColor: color.crawlerBand,
  },
}

/** The band each kind's sheet wears, as its unfurl's side bar. */
const TONE: Record<SheetKind, string> = {
  pilot: color.pilot,
  mech: color.mech,
  crawler: color.crawlerBand,
}

function fromStarter(page: StarterPage, kind: SheetKind): PublicPage {
  return {
    path: page.path,
    words: { title: page.title, description: page.description, themeColor: TONE[kind] },
  }
}

/** Every public page's path inside the app: the front door, the Starter Set, then each build. */
function publicPaths(): string[] {
  return [FRONT_DOOR_PATH, STARTER_SET.path, ...starterPages().map((page) => page.path)]
}

/** `origin` + base + an app path: the address a canonical and the sitemap name. */
function publicUrl(origin: string, base: string, path: string): string {
  return `${origin}${base}${path}`
}

/** The shell's meta block for a page with words of its own; the picture is the site's own. */
function publicMeta(page: PublicPage, origin: string, base: string): ShellMeta {
  const url = publicUrl(origin, base, page.path)
  return {
    ...page.words,
    url,
    canonical: url,
    image: { url: `${origin}/og-image.png`, alt: page.words.title },
  }
}

/** The public pages' urlset: `sitemap.xml`, inside the app's base. */
export function sitemapXml(origin: string, base: string): string {
  return urlsetXml(publicPaths().map((path) => publicUrl(origin, base, path)))
}

/** A page's pre-rendered shell, by its file under the base. */
export type PublicShell = { file: string; html: string }

/** The Starter Set's and each build's shell, from the app's own. */
export function publicShells(shell: string, origin: string, base: string): PublicShell[] {
  const builds = starterPages().flatMap((page) => {
    const kind = page.path.split('/')[2] ?? ''
    return isSheetKind(kind) ? [fromStarter(page, kind)] : []
  })
  return [STARTER_SET, ...builds].map((page) => ({
    file: `${page.path.slice(1)}.html`,
    html: applyMeta(shell, publicMeta(page, origin, base)),
  }))
}

/** The front door's shell: the defaults, and its canonical. */
export function frontDoorShell(shell: string, origin: string, base: string): string {
  return applyCanonical(shell, publicUrl(origin, base, FRONT_DOOR_PATH))
}
