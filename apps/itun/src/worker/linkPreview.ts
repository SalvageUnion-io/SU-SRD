/**
 * Link previews for player things (issue 1280): the unfurl's words in the
 * shell, and its picture on request.
 *
 * ## The words
 *
 * An unfurl bot (`Discordbot/2.0`) asks for `/p/:kind/:appId` or
 * `/join/:code` without `Sec-Fetch-Mode: navigate`, so it reaches the Worker
 * rather than Static Assets' SPA fallback. `metaFor` asks Convex what a
 * stranger may see (`publicSheet.preview`, `publicSheet.invitePreview`), turns
 * the answer into the card's words (`previewSummary.ts`, shared with the
 * render surface) and the shell's meta block is swapped for them.
 *
 * - A sheet or pattern that is not shared by link unfurls as the plain
 *   **Private** card: no name, no stats, no maker. Private and missing are the
 *   same answer, as on the page.
 * - A dead invite, or a Convex that does not answer, keeps the sitewide
 *   defaults: an unfurl is never worth a broken page.
 *
 * ## The picture
 *
 * `og:image` is `/og/:kind/:id.png?v=<version>`, and `ogImage` answers it by
 * screenshotting the SPA's `/og/:kind/:id` render surface (`OgCard` at 1200 ×
 * 630) through Cloudflare Browser Rendering. The version is a hash of the
 * public answer, so an edit is a new image, and the cache is keyed by it:
 *
 * - **cached by version** in the Cache API, so a card renders once per edit;
 * - **purged on edit**: every request re-reads the answer first, so a stale
 *   version is never served, whatever `v` the URL carries;
 * - **purged when made private**: that re-read answers null, and the request
 *   gets the private card instead. The old version's entry is unreachable.
 *
 * Rendering needs `CF_ACCOUNT_ID` and `BROWSER_RENDERING_TOKEN` (owner-set
 * secrets). Without them no `og:image` is advertised and the unfurl is text.
 *
 * Every URL is built from the request's own origin, so this works on
 * intheunionnow.com today and on itun.salvageunion.io after the move.
 */
import { reportError } from 'observability/cloudflare'
import type {
  InvitePreviewAnswer,
  PreviewAnswer,
  PreviewCard,
  PreviewKind,
} from '../lib/linkPreview/previewSummary'
import {
  inviteCard,
  isPreviewKind,
  previewWords,
  privateCard,
  sheetCard,
  titleCaseSlug,
} from '../lib/linkPreview/previewSummary'
import type { ShellMeta } from './shellMeta'

export type PreviewEnv = {
  /** The Convex deployment's client URL (`*.convex.cloud`). */
  CONVEX_URL?: string
  /** The Cloudflare account Browser Rendering bills to. */
  CF_ACCOUNT_ID?: string
  /** An API token with Browser Rendering edit permission. */
  BROWSER_RENDERING_TOKEN?: string
}

/** The routes a player shares, and what they name. */
export type PreviewRoute =
  | { type: 'sheet'; kind: PreviewKind; id: string }
  | { type: 'invite'; code: string }

/**
 * Bump when the card's RENDERING changes (OgCard, ChapterBand, fonts), since
 * the answer alone cannot see it: every cached image re-renders.
 */
export const OG_RENDER_VERSION = 1

const SEGMENT = /^[A-Za-z0-9_-]{1,64}$/

/** The shared route a path names, or null. */
export function previewRouteOf(path: string): PreviewRoute | null {
  const parts = path.split('/').filter((part) => part.length > 0)
  if (parts.length === 3 && parts[0] === 'p') {
    const [, kind = '', id = ''] = parts
    return isPreviewKind(kind) && SEGMENT.test(id) ? { type: 'sheet', kind, id } : null
  }
  if (parts.length === 2 && parts[0] === 'join') {
    const code = parts[1] ?? ''
    return SEGMENT.test(code) ? { type: 'invite', code } : null
  }
  return null
}

type Fetch = (input: Request | string, init?: RequestInit) => Promise<Response>

/**
 * One public Convex query over its HTTP API. `undefined` means Convex did not
 * answer — distinct from a `null` answer, which means "not shared".
 */
async function convexQuery<T>(
  env: PreviewEnv,
  path: string,
  args: Record<string, unknown>,
  fetchImpl: Fetch
): Promise<T | null | undefined> {
  if (!env.CONVEX_URL) return undefined
  try {
    const res = await fetchImpl(`${env.CONVEX_URL}/api/query`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ path, args, format: 'json' }),
    })
    if (!res.ok) return undefined
    const payload = (await res.json()) as { status?: string; value?: T | null }
    return payload.status === 'success' ? (payload.value ?? null) : undefined
  } catch (error) {
    // The unfurl falls back to the sitewide defaults; the failure is reported
    // so a Convex outage does not look like a quiet week of shares.
    reportError(error, { where: 'linkPreview.convexQuery', path })
    return undefined
  }
}

/** The public answer behind a route: what the card and its version are made of. */
type Resolved =
  | { kind: 'sheet'; route: PreviewRoute & { type: 'sheet' }; answer: PreviewAnswer | null }
  | { kind: 'invite'; route: PreviewRoute & { type: 'invite' }; answer: InvitePreviewAnswer | null }

async function resolve(
  route: PreviewRoute,
  env: PreviewEnv,
  fetchImpl: Fetch
): Promise<Resolved | undefined> {
  if (route.type === 'sheet') {
    const answer = await convexQuery<PreviewAnswer>(
      env,
      'publicSheet:preview',
      { kind: route.kind, appId: route.id },
      fetchImpl
    )
    return answer === undefined ? undefined : { kind: 'sheet', route, answer }
  }
  const answer = await convexQuery<InvitePreviewAnswer>(
    env,
    'publicSheet:invitePreview',
    { code: route.code },
    fetchImpl
  )
  return answer === undefined ? undefined : { kind: 'invite', route, answer }
}

/** The page address the card's foot prints: host and path, never a scheme. */
function addressOf(origin: string, route: PreviewRoute): string {
  const host = new URL(origin).host
  return route.type === 'sheet' ? `${host}/p/${route.kind}/${route.id}` : host
}

function cardOf(resolved: Resolved, origin: string): PreviewCard | null {
  if (resolved.kind === 'sheet') {
    const address = addressOf(origin, resolved.route)
    return resolved.answer
      ? sheetCard(resolved.answer, titleCaseSlug, address)
      : privateCard(new URL(origin).host)
  }
  // A dead invite is not a private thing: it keeps the sitewide defaults.
  return resolved.answer ? inviteCard(resolved.answer, addressOf(origin, resolved.route)) : null
}

/** FNV-1a, as eight hex digits: a cache key, not a secret. */
export function versionOf(value: unknown): string {
  const input = `${OG_RENDER_VERSION}:${JSON.stringify(value)}`
  let hash = 0x811c9dc5
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193)
  }
  return (hash >>> 0).toString(16).padStart(8, '0')
}

/** Where a resolved route's picture lives, versioned by what it shows. */
function imagePathOf(resolved: Resolved): string {
  if (resolved.answer === null) return `/og/private.png?v=${OG_RENDER_VERSION}`
  const v = versionOf(resolved.answer)
  return resolved.kind === 'sheet'
    ? `/og/${resolved.route.kind}/${resolved.route.id}.png?v=${v}`
    : `/og/invite/${resolved.route.code}.png?v=${v}`
}

function canRender(env: PreviewEnv): boolean {
  return !!env.CF_ACCOUNT_ID && !!env.BROWSER_RENDERING_TOKEN
}

/** The meta block for a shared route, or null to keep the sitewide defaults. */
export async function metaFor(
  route: PreviewRoute,
  url: URL,
  env: PreviewEnv,
  fetchImpl: Fetch = fetch
): Promise<ShellMeta | null> {
  const resolved = await resolve(route, env, fetchImpl)
  if (resolved === undefined) return null
  const card = cardOf(resolved, url.origin)
  if (card === null) return null
  const words = previewWords(card)
  return {
    ...words,
    url: `${url.origin}${url.pathname}`,
    ...(canRender(env)
      ? { image: { url: `${url.origin}${imagePathOf(resolved)}`, alt: words.title } }
      : {}),
  }
}

/** `/og/:kind/:id.png` and `/og/private.png` — the picture routes. */
export function isOgImagePath(path: string): boolean {
  return path.startsWith('/og/') && path.endsWith('.png')
}

/** The render surface a picture route screenshots, and its route for the answer. */
function surfaceOf(path: string): { surface: string; route: PreviewRoute | null } | null {
  if (path === '/og/private.png') return { surface: '/og/private', route: null }
  const match = path.match(/^\/og\/([a-z]+)\/([A-Za-z0-9_-]{1,64})\.png$/)
  if (!match) return null
  const [, kind = '', id = ''] = match
  if (kind === 'invite') return { surface: `/og/invite/${id}`, route: { type: 'invite', code: id } }
  if (isPreviewKind(kind))
    return { surface: `/og/${kind}/${id}`, route: { type: 'sheet', kind, id } }
  return null
}

/** The slice of the Cache API this uses. */
export type ImageCache = {
  match(key: Request): Promise<Response | undefined>
  put(key: Request, response: Response): Promise<void>
}

const NOT_FOUND = () =>
  new Response('Not found', { status: 404, headers: { 'cache-control': 'no-store' } })

/** One screenshot of a render surface, through Browser Rendering's REST API. */
async function screenshot(
  env: PreviewEnv,
  url: string,
  fetchImpl: Fetch
): Promise<ArrayBuffer | null> {
  const res = await fetchImpl(
    `https://api.cloudflare.com/client/v4/accounts/${env.CF_ACCOUNT_ID}/browser-rendering/screenshot`,
    {
      method: 'POST',
      headers: {
        authorization: `Bearer ${env.BROWSER_RENDERING_TOKEN}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        url,
        viewport: { width: 1200, height: 630 },
        gotoOptions: { waitUntil: 'networkidle0', timeout: 30_000 },
        // The surface sets it once the card, its data and its fonts are in.
        waitForSelector: { selector: '[data-og-ready]', timeout: 20_000 },
        screenshotOptions: { type: 'png' },
      }),
    }
  )
  if (!res.ok || !(res.headers.get('content-type') ?? '').startsWith('image/')) {
    reportError(new Error(`browser rendering answered ${res.status}`), {
      where: 'linkPreview.screenshot',
    })
    return null
  }
  return res.arrayBuffer()
}

/**
 * Answer a picture route: the current version's PNG, from the cache or freshly
 * rendered. A thing that is no longer shared gets the private card; a route
 * that names nothing is a 404.
 */
export async function ogImage(
  request: Request,
  env: PreviewEnv,
  deps: { cache: ImageCache | undefined; fetch?: Fetch }
): Promise<Response> {
  const fetchImpl = deps.fetch ?? fetch
  const url = new URL(request.url)
  const target = surfaceOf(url.pathname)
  if (target === null || !canRender(env)) return NOT_FOUND()

  let surface = target.surface
  let version = String(OG_RENDER_VERSION)
  if (target.route !== null) {
    const resolved = await resolve(target.route, env, fetchImpl)
    if (resolved === undefined || (resolved.kind === 'invite' && resolved.answer === null)) {
      return NOT_FOUND()
    }
    if (resolved.answer === null) {
      // Made private since the link was posted: the plain card, never the old one.
      surface = '/og/private'
    } else {
      version = versionOf(resolved.answer)
    }
  }

  const key = new Request(`${url.origin}${surface}.png?v=${version}`)
  const cached = await deps.cache?.match(key)
  if (cached) return cached

  const png = await screenshot(env, `${url.origin}${surface}`, fetchImpl)
  if (png === null) return NOT_FOUND()
  const response = new Response(png, {
    headers: {
      'content-type': 'image/png',
      // A day: the URL's `v` changes on every edit, and a private thing's
      // request is answered afresh above whatever a client still holds.
      'cache-control': 'public, max-age=86400',
    },
  })
  await deps.cache?.put(key, response.clone())
  return response
}
