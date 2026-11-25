/**
 * The site's root, which the Worker runs first (`wrangler.jsonc`,
 * `RUN_WORKER_FIRST`) for the Discord Activity's launch. The portal's root URL
 * Mapping is this site's root, so the app and its calls reach the Worker by
 * their own paths through Discord's proxy, and Discord launches the Activity
 * at `/` with its `frame_id` and `instance_id`. That launch gets the
 * Activity's page (`activity.html`); every other visit, the home page.
 */

type Assets = { fetch(request: Request): Promise<Response> }

/** The root's answer: the Activity's page for Discord's launch, else the home page. */
export function serveRoot(request: Request, assets: Assets): Promise<Response> {
  const url = new URL(request.url)
  if (!url.searchParams.has('frame_id') || !url.searchParams.has('instance_id')) {
    return assets.fetch(request)
  }
  return assets.fetch(new Request(new URL(`/activity${url.search}`, url), request))
}
