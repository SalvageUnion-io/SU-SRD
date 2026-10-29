/**
 * NO DEAD LINKS: every same-origin `href` and `src` a page the build wrote
 * carries opens something. A path resolves when the build wrote it (a file, or
 * a directory's `index.html`), when `_redirects` moves it, or when it is a
 * route of the app (`/build/…`, `/play/…`), matched against the app's route
 * tree.
 *
 * The app's shell answers every path under its base with a 200 and draws its
 * own Page Not Found, so a dead app link passes any status check; only the
 * route tree can tell. Run over the built HTML (`./site`) because that is
 * where a link actually holds or fails, and throw during the build, so a site
 * with a dead link never deploys.
 */

import { existsSync, statSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { routeInApp } from 'game-domain/appAddress'

/** A root-relative `href` or `src` (never a protocol-relative `//host`), up to its query or hash. */
const SITE_LINK = /\s(?:href|src)=["'](\/(?!\/)[^"'?#]*)/g

/** The route tree's `fullPaths` union: one quoted route per line. */
const FULL_PATHS = /fullPaths:\s*((?:\s*\|\s*'[^']*')+)/

/** A path without its trailing slash (`/` stays `/`). */
const bare = (path: string): string => (path.length > 1 ? path.replace(/\/+$/, '') : path)

/** The app's routes, from the generated route tree's source, as matchers (`$param` is one segment). */
export function appRouteMatchers(routeTreeSource: string): RegExp[] {
  const union = FULL_PATHS.exec(routeTreeSource)?.[1]
  if (!union) throw new Error('[build] the route tree names no routes (fullPaths)')
  return [...union.matchAll(/'([^']*)'/g)].map(([, route]) => {
    const source = bare(route as string)
      .split('/')
      .map((segment) =>
        segment.startsWith('$') ? '[^/]+' : segment.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      )
      .join('/')
    return new RegExp(`^${source || '/'}$`)
  })
}

/** The source paths `_redirects` moves (its first column). */
export function redirectSources(redirects: string): Set<string> {
  return new Set(
    redirects
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('#'))
      .map((line) => line.split(/\s+/)[0] as string)
  )
}

type Site = {
  /** Whether the build wrote this path: a file, or a directory with an `index.html`. */
  wrote: (path: string) => boolean
  redirects: Set<string>
  appRoutes: RegExp[]
}

/** Whether a root-relative path opens something on the built site. */
export function resolves(path: string, site: Site): boolean {
  if (site.wrote(path) || site.redirects.has(path)) return true
  const route = routeInApp(bare(path))
  return route !== null && site.appRoutes.some((matcher) => matcher.test(bare(route)))
}

/** Every root-relative link in a page's HTML. */
export function siteLinks(html: string): string[] {
  return [...html.matchAll(SITE_LINK)].map((match) => match[1] as string)
}

type DeadLink = { page: string; href: string }

async function findDeadLinks(distDir: string, routeTreeSource: string): Promise<DeadLink[]> {
  const site: Site = {
    wrote: (path) => {
      let file: string
      try {
        file = join(distDir, decodeURIComponent(path))
      } catch {
        return false
      }
      return (existsSync(file) && statSync(file).isFile()) || existsSync(join(file, 'index.html'))
    },
    redirects: redirectSources(await readFile(join(distDir, '_redirects'), 'utf-8')),
    appRoutes: appRouteMatchers(routeTreeSource),
  }
  const dead: DeadLink[] = []
  const seen = new Map<string, boolean>()
  for await (const page of new Bun.Glob('**/*.html').scan(distDir)) {
    const html = await readFile(join(distDir, page), 'utf-8')
    for (const href of siteLinks(html)) {
      let ok = seen.get(href)
      if (ok === undefined) {
        ok = resolves(href, site)
        seen.set(href, ok)
      }
      if (!ok) dead.push({ page, href })
    }
  }
  return dead
}

/** Throws if any emitted page links to a path that opens nothing. */
export async function assertNoDeadLinks(distDir: string, routeTreeSource: string): Promise<void> {
  const dead = await findDeadLinks(distDir, routeTreeSource)
  if (dead.length === 0) return
  const hrefs = new Map<string, string[]>()
  for (const { page, href } of dead) hrefs.set(href, [...(hrefs.get(href) ?? []), page])
  const shown = [...hrefs].slice(0, 15)
  throw new Error(
    `[build] refusing to finish: ${hrefs.size} link target(s) open nothing.\n` +
      shown
        .map(([href, pages]) => `  ${href}\n    from ${pages.slice(0, 3).join(', ')}`)
        .join('\n') +
      (hrefs.size > shown.length ? `\n  ...and ${hrefs.size - shown.length} more\n` : '\n') +
      '\n  A reference page is linked by its slug path (`itemHref`), an app page by\n' +
      '  its route through `appPath`; inside the app, an entity opens through its\n' +
      '  surface, never an SRD path handed to the router (it lands under /build).\n'
  )
}
