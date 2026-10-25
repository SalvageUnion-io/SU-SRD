/**
 * appPlugins — what the Astro config (`astro.config.ts`) adds to its Vite for
 * the app: the refusal to build without a Convex URL, the base stylesheet's
 * address for the reference site's head, and the dev server's own answers
 * (the app's shell for its navigations, the homebrew read). The build writes
 * the shell as a page (`astro/pages/build/index.astro`) and its public pages
 * after it (`writePublicPages`).
 *
 * Every `transformIndexHtml` here acts on the app's shell alone (it carries
 * the `app:meta` markers).
 */

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import type { Connect, Plugin } from 'vite'
import { APP_BASE, routeInApp } from '../../src/lib/appBase'
import { HOMEBREW_PATTERNS_PATH } from '../../src/lib/homebrew/endpoint'
import { originOf } from '../../src/lib/site'
import { SITE_MANIFEST } from '../../src/pwa'
import { renderShell } from '../../src/shell/shell'
import { buildBaseStylesheet, DEV_BASE_STYLESHEET } from '../../src/styles/baseStylesheet'
import { serveHomebrew } from '../../src/worker/homebrew'
import { publicShells, sitemapXml } from '../../src/worker/publicPages'
import { markUnionRoute } from '../../src/worker/shellMeta'
import { pickFontPreloads, pickScriptFontPreload } from './fontPreloads'

/**
 * Every build and dev server talks to a Convex deployment
 * (`src/lib/connection/convexClient.ts`), so one without its URL is
 * refused here rather than shipped as an app that can read and write nothing.
 *
 * A plugin hook, not a check in the config function: Vite runs
 * `configResolved` only when it builds, serves or previews, while tools that
 * merely load the config to read it never reach it.
 */
export function requireConvexUrl(): Plugin {
  return {
    name: 'app-require-convex-url',
    configResolved({ env }) {
      if (env.VITE_CONVEX_URL) return
      throw new Error(
        'VITE_CONVEX_URL is not set. Run `bun run dev`, which writes it into apps/web/.env.local ' +
          'for the local deployment, or pass it in the environment (`convex deploy --cmd-url-env-var-name ' +
          'VITE_CONVEX_URL`, as CI and the deploy do).'
      )
    },
  }
}

/**
 * `virtual:base-stylesheet`: the base stylesheet's URL and the faces every
 * page preloads (`./fontPreloads`), for the reference site's head and the
 * app's shell (`astro/lib/assets.ts`). The dev server links the source and
 * preloads none.
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
      if (!build)
        return `export default ${JSON.stringify({ href: DEV_BASE_STYLESHEET, fonts: [] })}`
      const { href, files } = await buildBaseStylesheet()
      const emitted = files.map((file) => file.fileName)
      const base = {
        href,
        fonts: pickFontPreloads(emitted),
        scriptFont: pickScriptFontPreload(emitted),
      }
      return `export default ${JSON.stringify(base)}`
    },
  }
}

/** Whether a dev request is a navigation into the app. */
function isAppNavigation(url: string, accept: string): boolean {
  const path = url.split('?')[0] ?? ''
  return routeInApp(path) !== null && !/\.[a-z0-9]+$/i.test(path) && accept.includes('text/html')
}

/** Whether a document is the app's shell (`shell.ts`'s `app:meta` block). */
const isShell = (html: string): boolean => html.includes('app:meta')

/**
 * Dev only: every navigation under `/build` and `/play` gets the shell
 * (`src/shell/shell.ts`) with its entry from source, the base stylesheet and
 * the manifest after its title, marked for its route as the Worker serves it
 * (`worker/app.ts`). Ahead of Astro's page handler, which would answer a deep
 * app path with the 404.
 */
export function appShellInDev(): Plugin {
  return {
    name: 'app-shell-in-dev',
    apply: 'serve',
    transformIndexHtml: {
      order: 'post',
      handler: (html) =>
        isShell(html)
          ? html.replace(
              '</title>',
              `</title><link rel="stylesheet" href="${DEV_BASE_STYLESHEET}"><link rel="manifest" href="${SITE_MANIFEST}">`
            )
          : html,
    },
    configureServer(server) {
      const shell: Connect.NextHandleFunction = async (req, res, next) => {
        const url = req.originalUrl ?? req.url ?? '/'
        if (!isAppNavigation(url, req.headers.accept ?? '')) return next()
        try {
          const route = routeInApp(url.split(/[?#]/)[0] ?? '') ?? '/'
          const html = markUnionRoute(await server.transformIndexHtml(url, renderShell()), route)
          res.setHeader('Content-Type', 'text/html; charset=utf-8')
          res.end(html)
        } catch (error) {
          next(error)
        }
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
 * Dev only: the Worker's homebrew read (`src/worker/homebrew.ts`), which the
 * reference's Show Homebrew fetches, answered from the local Convex
 * deployment.
 */
export function homebrewInDev(): Plugin {
  return {
    name: 'homebrew-in-dev',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = new URL(req.url ?? '/', 'http://localhost')
        if (url.pathname !== HOMEBREW_PATTERNS_PATH) return next()
        const answer = await serveHomebrew(url, { CONVEX_URL: process.env.VITE_CONVEX_URL })
        res.statusCode = answer.status
        res.setHeader('Content-Type', answer.headers.get('content-type') ?? 'application/json')
        res.setHeader('Cache-Control', 'no-store')
        res.end(await answer.text())
      })
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
