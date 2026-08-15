import { createNetlifyBlobsStorage } from '../../src/lib/snapshot/storage'

/** Diagnostic probe — NOT for merge. Isolates importing app source from
 * `../../src/lib/`, which every snapshot function does and no other probe does.
 * @public Netlify Functions handler: invoked by the platform, never imported.
 */
export default async function (): Promise<Response> {
  return new Response(`src import ok: ${typeof createNetlifyBlobsStorage}`)
}
