import { initObservability } from '../lib/observability'

/** Diagnostic probe — NOT for merge. Isolates the observability import, i.e.
 * the `observability` workspace package plus the externalized `@sentry/node`.
 * @public Netlify Functions handler: invoked by the platform, never imported.
 */
export default async function (): Promise<Response> {
  return new Response(`observability import ok: ${typeof initObservability}`)
}
