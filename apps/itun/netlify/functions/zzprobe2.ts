import { getStore } from '@netlify/blobs'

/** Diagnostic probe — NOT for merge. Isolates the `@netlify/blobs` import.
 * @public Netlify Functions handler: invoked by the platform, never imported.
 */
export default async function (): Promise<Response> {
  return new Response(`blobs import ok: ${typeof getStore}`)
}
