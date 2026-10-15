/**
 * cantinaPlugins — what the one Vite config (`vite.config.ts`) adds for the
 * Cantina: its shell as an HTML entry at `build/index.html`, the base
 * stylesheet and the site's manifest linked from it, its public pages and
 * sitemap, and the refusal to build without a Convex URL.
 *
 * Every `transformIndexHtml` here acts on the Cantina's shell alone (it carries
 * the `cantina:meta` markers): the dev server runs the same hooks over srd's
 * pages, which link their own stylesheets and manifest.
 */

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import type { Plugin } from 'vite'
import { basePathOf, SITE } from '../src/cantina/lib/site'
import { renderShell } from '../src/cantina/shell/shell'
import { publicShells, sitemapXml } from '../src/cantina/worker/publicPages'
import { SITE_MANIFEST } from '../src/pwa'
import { buildBaseStylesheet, DEV_BASE_STYLESHEET } from '../src/styles/baseStylesheet'

const APP_ROOT = join(import.meta.dirname, '..')

/** The Cantina's base without its trailing slash, `/build` (ADR-048). */
const PREFIX = basePathOf(SITE.base)

/**
 * The shell's module id: Vite's HTML entry, rendered rather than read from
 * disk. Its path under the root is its output path, `build/index.html`.
 */
export const CANTINA_ENTRY = join(APP_ROOT, PREFIX.slice(1), 'index.html')

/** Whether a document is the Cantina's shell (`shell.ts`'s `cantina:meta` block). */
const isShell = (html: string): boolean => html.includes('cantina:meta')

/** A `transformIndexHtml` that leaves srd's pages alone. */
function onShell(order: 'pre' | 'post', handler: (html: string) => string) {
  return { order, handler: (html: string) => (isShell(html) ? handler(html) : html) }
}

/**
 * Every build and dev server talks to a Convex deployment
 * (`src/cantina/lib/connection/convexClient.ts`), so one without its URL is
 * refused here rather than shipped as an app that can read and write nothing.
 *
 * A plugin hook, not a check in the config function: Vite runs
 * `configResolved` only when it builds, serves or previews, while tools that
 * merely load the config to read it (knip calls the function for every
 * command and mode) never reach it.
 */
export function requireConvexUrl(): Plugin {
  return {
    name: 'cantina-require-convex-url',
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

/** Whether a dev request is a navigation into the Cantina. */
function isCantinaNavigation(url: string, accept: string): boolean {
  const path = url.split('?')[0] ?? ''
  const inBase = path === PREFIX || path.startsWith(`${PREFIX}/`)
  return inBase && !/\.[a-z0-9]+$/i.test(path) && accept.includes('text/html')
}

/**
 * The shell (`src/cantina/shell/shell.ts`) is the Cantina's HTML entry: the
 * build loads it as `CANTINA_ENTRY` and emits `build/index.html` from it; the
 * dev server answers every navigation under `/build` with it, once Vite's own
 * middlewares (modules, `public/`) have passed the request on.
 */
export function cantinaShell(): Plugin {
  return {
    name: 'cantina-shell',
    enforce: 'pre',
    resolveId(id) {
      return id === CANTINA_ENTRY ? CANTINA_ENTRY : undefined
    },
    load(id) {
      return id === CANTINA_ENTRY ? renderShell() : undefined
    },
    configureServer(server) {
      return () => {
        server.middlewares.use(async (req, res, next) => {
          const url = req.originalUrl ?? req.url ?? '/'
          if (!isCantinaNavigation(url, req.headers.accept ?? '')) return next()
          try {
            const html = await server.transformIndexHtml(url, renderShell())
            res.setHeader('Content-Type', 'text/html; charset=utf-8')
            res.end(html)
          } catch (error) {
            next(error)
          }
        })
      }
    },
  }
}

/**
 * The base stylesheet both apps link (`src/styles/baseStylesheet.ts`): the
 * fonts and the UI library's stylesheet, at `/assets/base-<hash>.css`, ahead
 * of the Cantina's own CSS. `emitBaseStylesheet` writes the files into this
 * same build. The dev server links the source.
 */
export function baseStylesheetLink(): Plugin {
  let href = DEV_BASE_STYLESHEET
  let build = false
  return {
    name: 'cantina-base-stylesheet',
    configResolved({ command }) {
      build = command === 'build'
    },
    async buildStart() {
      if (!build) return
      href = (await buildBaseStylesheet()).href
    },
    transformIndexHtml: onShell('post', (html) =>
      html.replace('</title>', `</title><link rel="stylesheet" href="${href}">`)
    ),
  }
}

/**
 * The site's one web manifest (`src/pwa.ts`), linked from the shell as srd's
 * pages link it: one install for both apps, opening on the Cantina.
 */
export function siteManifest(): Plugin {
  return {
    name: 'cantina-site-manifest',
    transformIndexHtml: onShell('post', (html) =>
      html.replace('</title>', `</title><link rel="manifest" href="${SITE_MANIFEST}">`)
    ),
  }
}

/**
 * The shell's default link-preview tags name production's address. A Worker
 * Preview's build is given its own origin as `VITE_SITE_ORIGIN`
 * (`deploy-preview.yml`), and its shell names that instead, so a pasted
 * Preview link unfurls with the Preview's image and address. The Worker's
 * per-route tags already use the request's origin (`linkPreview.ts`).
 */
export function shellOrigin(): Plugin {
  let origin = ''
  return {
    name: 'cantina-shell-origin',
    apply: 'build',
    configResolved({ env }) {
      origin = (env.VITE_SITE_ORIGIN ?? '').replace(/\/+$/, '')
    },
    transformIndexHtml: onShell('pre', (html) =>
      origin ? html.replaceAll(`${SITE.origin}${SITE.base}`, `${origin}${SITE.base}`) : html
    ),
  }
}

/**
 * The public pages a crawler reads (`src/cantina/worker/publicPages.ts`): the
 * Starter Set's and each build's shell, with its own title, description,
 * canonical and `og:*`, beside the app's, and `build/sitemap.xml`. Named for
 * the deployment's origin, as `shellOrigin` names the shell's.
 */
export function publicPages(): Plugin {
  let origin = SITE.origin
  return {
    name: 'cantina-public-pages',
    apply: 'build',
    configResolved({ env }) {
      origin = (env.VITE_SITE_ORIGIN || SITE.origin).replace(/\/+$/, '')
    },
    writeBundle({ dir = '' }) {
      const out = join(dir, PREFIX)
      const shell = readFileSync(join(out, 'index.html'), 'utf8')
      for (const { file, html } of publicShells(shell, origin, PREFIX)) {
        mkdirSync(dirname(join(out, file)), { recursive: true })
        writeFileSync(join(out, file), html)
      }
      writeFileSync(join(out, 'sitemap.xml'), sitemapXml(origin, PREFIX))
    },
  }
}

/**
 * Renders every page into the finished bundle (`ssg/prerender.ts`), as the first
 * `closeBundle` step, so the service worker, generated last, precaches a
 * complete site. Its own process: `ssg/prerender.ts` says why.
 */
export function prerender(): Plugin {
  return {
    name: 'prerender',
    apply: 'build',
    closeBundle: {
      order: 'pre',
      sequential: true,
      async handler() {
        const render = Bun.spawn([process.execPath, join(APP_ROOT, 'ssg', 'prerender.ts')], {
          cwd: APP_ROOT,
          stdout: 'inherit',
          stderr: 'inherit',
        })
        if ((await render.exited) !== 0) throw new Error('[prerender] rendering failed (above).')
      },
    },
  }
}
