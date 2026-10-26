/**
 * appPlugins — what the Astro config (`astro.config.ts`) adds to its Vite for
 * the app: the base stylesheet's address for the reference site's head, and
 * the dev server's answer to the app's navigations. The shell is a page
 * (`astro/pages/build/index.astro`); the build writes its public pages after
 * it (`writePublicPages`).
 */

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import type { Connect, Plugin } from 'vite'
import { APP_BASE, routeInApp } from '../../src/lib/appBase'
import { originOf } from '../../src/lib/site'
import { buildBaseStylesheet, DEV_BASE_STYLESHEET } from '../../src/styles/baseStylesheet'
import { publicShells, sitemapXml } from '../../src/worker/publicPages'

/**
 * `virtual:base-stylesheet`: the base stylesheet's URL, for the reference
 * site's head and the app's shell (`astro/lib/assets.ts`). The dev server
 * links the source.
 */
export function baseStylesheetModule(): Plugin {
  const id = 'virtual:base-stylesheet'
  const resolved = `\0${id}`
  let build = false
  return {
    name: 'base-stylesheet-module',
    configResolved({ command }) {
      build = command === 'build'
    },
    resolveId: (source) => (source === id ? resolved : undefined),
    async load(source) {
      if (source !== resolved) return undefined
      const href = build ? (await buildBaseStylesheet()).href : DEV_BASE_STYLESHEET
      return `export default ${JSON.stringify({ href })}`
    },
  }
}

/** Whether a dev request is a navigation into the app. */
function isAppNavigation(url: string, accept: string): boolean {
  const path = url.split('?')[0] ?? ''
  return routeInApp(path) !== null && !/\.[a-z0-9]+$/i.test(path) && accept.includes('text/html')
}

/**
 * Dev only: every navigation under `/build` and `/play` is the shell's page,
 * as the Worker answers it (`worker/app.ts`), its entry from source. Ahead of
 * Astro's page handler, which would answer a deep app path with the 404; the
 * app marks the Union bar for its route as it mounts.
 */
export function appShellInDev(): Plugin {
  return {
    name: 'app-shell-in-dev',
    apply: 'serve',
    configureServer(server) {
      const shell: Connect.NextHandleFunction = (req, _res, next) => {
        if (isAppNavigation(req.originalUrl ?? req.url ?? '/', req.headers.accept ?? '')) {
          req.url = `${APP_BASE}/`
        }
        next()
      }
      // After Astro's own setup, then to the front of the stack: Astro puts its
      // trailing-slash rule there, which would 404 `/build/starter`.
      return () => {
        server.middlewares.stack.unshift({ route: '', handle: shell })
      }
    },
  }
}

/**
 * The public pages a crawler reads (`src/worker/publicPages.ts`): the
 * Starter Set's and each build's shell, with its own title, description,
 * canonical and `og:*`, beside the app's, and `build/sitemap.xml`. Named for
 * the deployment's origin, as the shell is (`./appShell`).
 */
export function writePublicPages(distDir: string, siteOrigin: string | undefined): void {
  const origin = originOf(siteOrigin)
  const out = join(distDir, APP_BASE)
  const shell = readFileSync(join(out, 'index.html'), 'utf8')
  for (const { file, html } of publicShells(shell, origin, APP_BASE)) {
    mkdirSync(dirname(join(out, file)), { recursive: true })
    writeFileSync(join(out, file), html)
  }
  writeFileSync(join(out, 'sitemap.xml'), sitemapXml(origin, APP_BASE))
}
