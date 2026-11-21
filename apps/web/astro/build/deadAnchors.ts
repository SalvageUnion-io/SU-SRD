/**
 * NO DEAD ANCHORS: every in-page link a built page carries lands on an
 * element. `#training` needs an element of that id on its own page;
 * `/classes/hacker/#tree-hacking` needs one on that page. A link whose target
 * is missing changes the address and moves nothing, which no status check and
 * no dead-link scan (`./deadLinks`) can see.
 *
 * Run over the built HTML, where a link actually holds or fails: by the build
 * (`./site`), so a site with a dead anchor never deploys, and by the
 * `page-anchors` gate over an existing build (`tools/check-page-anchors.ts`).
 *
 * The app's pages are not judged here: its shell is one built page and what
 * stands at `/build/#pilots` is drawn in the browser. Its in-page links are
 * held where they are made, by each landing page's test against `areaAnchors`
 * (`unionBar/areaNav.model.ts`).
 */

import { existsSync, readFileSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { routeInApp } from 'game-domain/appAddress'

/** An `href` with a fragment: this page's (`#id`) or a root-relative page's (never `//host`). */
const FRAGMENT_LINK = /\shref=["']((?:\/(?!\/)[^"'#]*)?)#([^"']+)["']/g

/** An element's `id`, or an anchor's `name`. */
const TARGET = /\s(?:id|name)=(?:"([^"]*)"|'([^']*)')/g

/** A script's body is data or code, never the page's elements. Its end tag may carry anything before `>`. */
const SCRIPT = /<script\b[\s\S]*?<\/script\b[^>]*>/gi

/** The page without its scripts: cut until none is left, so no cut can join two halves into another. */
function withoutScripts(html: string): string {
  let rest = html
  let before: string
  do {
    before = rest
    rest = rest.replace(SCRIPT, '')
  } while (rest !== before)
  return rest
}

/** A text directive (`#:~:text=…`) names words, not an element. */
const TEXT_DIRECTIVE = ':~:'

export type FragmentLink = {
  /** The page it names, without query; empty for the page it is on. */
  path: string
  id: string
}

/** Every link on a page that names an element: its own, or another page of the site's. */
export function fragmentLinks(html: string): FragmentLink[] {
  const links: FragmentLink[] = []
  for (const [, target = '', fragment = ''] of withoutScripts(html).matchAll(FRAGMENT_LINK)) {
    if (fragment.startsWith(TEXT_DIRECTIVE)) continue
    let id: string
    try {
      id = decodeURIComponent(fragment)
    } catch {
      id = fragment
    }
    links.push({ path: target.replace(/\?.*$/, ''), id })
  }
  return links
}

/** Every target a page offers a fragment: its elements' ids and named anchors. */
export function pageIds(html: string): Set<string> {
  const ids = new Set<string>()
  for (const [, double, single] of withoutScripts(html).matchAll(TARGET)) {
    ids.add(double ?? single ?? '')
  }
  return ids
}

type Site = {
  /** The ids of the page the build wrote at `path`, or undefined where it wrote none (an app route, a file). */
  idsOf: (path: string) => Set<string> | undefined
}

/** The links on the page at `path` that land on nothing, as their `href`s. */
export function deadAnchorsOn(path: string, html: string, site: Site): string[] {
  const own = pageIds(html)
  const dead: string[] = []
  for (const link of fragmentLinks(html)) {
    const ids = link.path === '' || link.path === path ? own : site.idsOf(link.path)
    if (ids && !ids.has(link.id)) dead.push(`${link.path}#${link.id}`)
  }
  return dead
}

/** A built page's file for a path: `/chassis/mule/` or `/chassis/mule` is `chassis/mule/index.html`. */
function pageFile(distDir: string, path: string): string | undefined {
  let decoded: string
  try {
    decoded = decodeURIComponent(path)
  } catch {
    return undefined
  }
  if (decoded.endsWith('.html')) return join(distDir, decoded)
  return join(distDir, decoded, 'index.html')
}

/** A built page's path: `chassis/mule/index.html` is `/chassis/mule/`. */
function pagePath(file: string): string {
  return `/${file.replace(/(^|\/)index\.html$/, '$1')}`
}

export type DeadAnchor = { page: string; href: string }

/** Every dead anchor on the pages the build wrote under `distDir`, the app's shell aside. */
export async function findDeadAnchors(distDir: string): Promise<DeadAnchor[]> {
  const inApp = (path: string) => routeInApp(path || '/') !== null
  const cache = new Map<string, Set<string> | undefined>()
  const site: Site = {
    idsOf: (path) => {
      const bare = path.replace(/\/+$/, '')
      if (inApp(bare)) return undefined
      if (cache.has(bare)) return cache.get(bare)
      const file = pageFile(distDir, path)
      const ids = file && existsSync(file) ? pageIds(readFileSync(file, 'utf-8')) : undefined
      cache.set(bare, ids)
      return ids
    },
  }
  const dead: DeadAnchor[] = []
  for await (const file of new Bun.Glob('**/*.html').scan(distDir)) {
    const path = pagePath(file)
    if (inApp(path.replace(/\/+$/, ''))) continue
    const html = await readFile(join(distDir, file), 'utf-8')
    for (const href of deadAnchorsOn(path, html, site)) dead.push({ page: file, href })
  }
  return dead
}

/** The failure's words: each dead `href` once, with the pages that carry it. */
export function deadAnchorReport(dead: readonly DeadAnchor[]): string {
  const hrefs = new Map<string, string[]>()
  for (const { page, href } of dead) hrefs.set(href, [...(hrefs.get(href) ?? []), page])
  const shown = [...hrefs].slice(0, 20)
  return (
    `${hrefs.size} in-page link(s) land on nothing.\n` +
    shown
      .map(
        ([href, pages]) =>
          `  ${href}\n    from ${pages.slice(0, 3).join(', ')}${pages.length > 3 ? ` (+${pages.length - 3})` : ''}`
      )
      .join('\n') +
    (hrefs.size > shown.length ? `\n  ...and ${hrefs.size - shown.length} more\n` : '\n') +
    '\n  Give the target the id the link names, or point the link at an id the\n' +
    '  page has; a link the page cannot keep is not drawn.\n'
  )
}

/** Throws if any page the build wrote carries an in-page link with no target. */
export async function assertNoDeadAnchors(distDir: string): Promise<void> {
  const dead = await findDeadAnchors(distDir)
  if (dead.length > 0) throw new Error(`[build] refusing to finish: ${deadAnchorReport(dead)}`)
}
