/**
 * site — the build's own steps around Astro's (ADR-065).
 *
 * After the pages are written (`bun run build` regenerates the nav catalog,
 * `./genNavCatalog`, before Astro starts): the app's public pages, the refusals that keep a broken build from looking like a finished one,
 * and, last, the service worker over the finished site, since its precache
 * needs the home page.
 */

import { readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { AstroIntegration } from 'astro'
import type { VitePluginPWAAPI } from 'vite-plugin-pwa'
import { writePublicPages } from './appPlugins'
import { executableInlineScripts, scriptHash, withScriptHashes } from './inlineScripts'
import { assertNoUuidLinks } from './linkAudit'
import { assertNoRawMarkup, findRawMarkup } from './rawMarkup'

/** Astro's island runtime and its directives, with room to spare. */
const MAX_INLINE_SCRIPTS = 12

/** A built page's route without its trailing slash (`/` stays `/`). */
const routeOf = (pathname: string): string => `/${pathname.replace(/^\/+|\/+$/g, '')}`

/** The dist file Astro wrote for a page (`build.format: 'directory'`, the 404 at `404.html`). */
const fileOf = (route: string): string =>
  route === '/' ? 'index.html' : route === '/404' ? '404.html' : `${route.slice(1)}/index.html`

/** `pwa` is the service worker plugin's API, to generate it over the finished site. */
export function site({ pwa }: { pwa: () => VitePluginPWAAPI | undefined }): AstroIntegration {
  return {
    name: 'salvageunion-site',
    hooks: {
      'astro:build:done': async ({ dir, pages, logger }) => {
        const distDir = fileURLToPath(dir)
        const routes = pages
          .map(({ pathname }) => routeOf(pathname))
          // Endpoints: a file name (`llms.txt`, `_redirects`), not a page.
          .filter((route) => !/^[_.]|\./.test(route.split('/').pop() ?? ''))

        // A page with no script or no stylesheet looks like a success and
        // deploys an unstyled, inert site; refuse it on the home page.
        const home = await readFile(join(distDir, 'index.html'), 'utf-8')
        if (!/<script type="module" src="\/assets\//.test(home) || !/rel="stylesheet"/.test(home)) {
          throw new Error(
            '[build] refusing to finish: the home page links no script or no stylesheet.'
          )
        }

        const raw: string[] = []
        const inline = new Set<string>()
        for (const route of routes) {
          const html = await readFile(join(distDir, fileOf(route)), 'utf-8')
          const found = findRawMarkup(html)
          if (found !== undefined) raw.push(`${route}: ${found}`)
          for (const script of executableInlineScripts(html)) inline.add(script)
        }
        assertNoRawMarkup(raw)
        // Astro's island runtime and directives: a handful, the same on every
        // page. Many more means a page inlines a script of its own.
        if (inline.size > MAX_INLINE_SCRIPTS) {
          throw new Error(
            `[build] ${inline.size} distinct inline scripts (at most ${MAX_INLINE_SCRIPTS}): load a page's own script by URL`
          )
        }
        const headersFile = join(distDir, '_headers')
        const headers = await readFile(headersFile, 'utf-8')
        await writeFile(headersFile, withScriptHashes(headers, [...inline].map(scriptHash)))
        await assertNoUuidLinks(distDir)

        writePublicPages(distDir, process.env.VITE_SITE_ORIGIN)

        const api = pwa()
        if (!api) throw new Error('[build] the service worker plugin is missing')
        await api.generateSW()
        logger.info('sw.js over the finished site')
      },
    },
  }
}
