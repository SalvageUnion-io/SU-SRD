/**
 * The site's root, which the Worker runs first (`wrangler.jsonc`,
 * `RUN_WORKER_FIRST`) for the Discord Activity's launch. The portal's root URL
 * Mapping is this site's root, so the app and its calls reach the Worker by
 * their own paths through Discord's proxy, and Discord launches the Activity
 * at `/` with its `frame_id` and `instance_id`. That launch gets the app's
 * shell (`/build/`), its Union bar hidden from the start: the app sees the
 * launch and runs as the Activity (`src/activity/`), whose screens draw no
 * site bar. Every other visit gets the home page.
 */

import { APP_BASE } from '../lib/appBase'
import { hideUnionBar } from './shellMeta'

type Assets = { fetch(request: Request): Promise<Response> }

/** Whether a request to the root is Discord's launch of the Activity. */
function isActivityLaunch(url: URL): boolean {
  return url.searchParams.has('frame_id') && url.searchParams.has('instance_id')
}

/** The root's answer: the app's shell for Discord's launch, else the home page. */
export async function serveRoot(request: Request, assets: Assets): Promise<Response> {
  const url = new URL(request.url)
  if (!isActivityLaunch(url)) return assets.fetch(request)
  const shell = await assets.fetch(new Request(new URL(`${APP_BASE}/`, url), request))
  if (!shell.ok) return shell
  const headers = new Headers(shell.headers)
  // The body changes length; the runtime recomputes it.
  headers.delete('content-length')
  headers.delete('etag')
  return new Response(hideUnionBar(await shell.text()), { status: shell.status, headers })
}
