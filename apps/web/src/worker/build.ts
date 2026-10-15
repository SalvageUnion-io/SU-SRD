/**
 * The Cantina, served by this Worker under `/build`: one Worker for both.
 *
 * `wrangler.jsonc`'s `run_worker_first` sends `/build` and everything under
 * it here before Static Assets looks (`RUN_WORKER_FIRST`, which the routing
 * test holds equal). Every other SRD page still never runs the script. The
 * Cantina's own Worker (`cantina/worker`) answers those requests; this module
 * hands it what a single-page app's Worker expects:
 *
 * - **an asset binding in single-page-application mode.** srd's binding is
 *   `not_found_handling: none`, so a miss under the base comes back 404. The
 *   wrapper answers it with the shell (`/build/`), as SPA mode did; the
 *   Cantina's rule 1 still turns a missing FILE back into a 404.
 * - **its vars.** `BASE_PATH` and `CONVEX_URL` are this Worker's too. Its
 *   `SRD_ORIGIN` is the request's own origin: the SRD and the Cantina are one
 *   origin, on a Worker Preview as in production.
 * - **its CSP.** The binding applies srd's `_headers`, whose CSP has no Convex
 *   origin, so sign-in would never complete. Every answer that carries a CSP
 *   gets the Cantina's instead (`CANTINA_CSP`); overwritten, never appended, as
 *   two CSP headers both apply and the stricter wins.
 */

import type { Env as CantinaEnv } from 'cantina/worker'
import cantina from 'cantina/worker'

/** The Cantina's base path, without a trailing slash: `BASE_PATH` in `wrangler.jsonc`. */
export const BUILD_BASE = '/build'

/**
 * `wrangler.jsonc`'s `run_worker_first`. A positive list only: a negative
 * pattern sends its matches straight to the assets, and `true` would run the
 * script for every SRD page.
 */
export const RUN_WORKER_FIRST = [BUILD_BASE, `${BUILD_BASE}/*`]

/**
 * The Cantina's Content-Security-Policy: `apps/cantina/public/_headers`, which
 * the routing test holds equal. `connect-src` keeps 'self' (error reports) and
 * the Convex origins (the accounts client, ADR-030).
 */
export const CANTINA_CSP =
  "default-src 'self'; script-src 'self' https://static.cloudflareinsights.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self'; connect-src 'self' https://cloudflareinsights.com https://*.convex.cloud wss://*.convex.cloud https://*.convex.site;"

type Assets = CantinaEnv['ASSETS']

/** What this Worker's env adds for the Cantina; all of it optional in a test. */
export type BuildEnv = Omit<CantinaEnv, 'ASSETS' | 'BASE_PATH' | 'SRD_ORIGIN'> & {
  BASE_PATH?: string
}

/** Whether a path is the Cantina's: `/build` itself or anything under it. */
export function isBuildPath(pathname: string): boolean {
  return pathname === BUILD_BASE || pathname.startsWith(`${BUILD_BASE}/`)
}

/** Answer a request under `/build` through the Cantina's Worker. */
export async function serveBuild(request: Request, env: BuildEnv & { ASSETS: Assets }) {
  const base = env.BASE_PATH ?? BUILD_BASE
  const res = await cantina.fetch(request, {
    ...env,
    ASSETS: spaAssets(env.ASSETS, base),
    BASE_PATH: base,
    SRD_ORIGIN: new URL(request.url).origin,
  })
  return withCantinaCsp(res)
}

/**
 * A binding that answers a miss under the base with the shell, as Static
 * Assets' `single-page-application` mode does. Anything else passes through.
 */
export function spaAssets(assets: Assets, base: string): Assets {
  return {
    async fetch(request: Request): Promise<Response> {
      const res = await assets.fetch(request)
      if (res.status !== 404 || !new URL(request.url).pathname.startsWith(`${base}/`)) return res
      const shell = new Request(new URL(`${base}/`, request.url), {
        method: request.method,
        headers: request.headers,
      })
      return assets.fetch(shell)
    },
  }
}

/** The answer with the Cantina's CSP in place of srd's, where it carries one. */
function withCantinaCsp(res: Response): Response {
  if (!res.headers.has('content-security-policy')) return res
  const out = new Response(res.body, res)
  out.headers.set('content-security-policy', CANTINA_CSP)
  return out
}
