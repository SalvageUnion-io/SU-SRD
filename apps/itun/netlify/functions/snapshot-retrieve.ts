/**
 * snapshot-retrieve — GET /api/snapshots/:id (Netlify adapter)
 *
 * The handler lives in `src/lib/snapshot/handlers.ts`; this file supplies Blobs
 * storage and Sentry. See the note in `snapshot-publish.ts` for why the split
 * exists (ADR-033: a second host, and esbuild follows modules not calls).
 *
 * See ADR-004 for the endpoint's contract, which is unchanged.
 */

import { makeRetrieveHandler } from '../../src/lib/snapshot/handlers'
import { setSnapshotReporter } from '../../src/lib/snapshot/report'
import { createNetlifyBlobsStorage } from '../../src/lib/snapshot/storageNetlify'
import { captureException, initObservability } from '../lib/observability'

export { makeRetrieveHandler }

/** @public Netlify Functions handler — invoked by the platform, not imported. */
export default async function (req: Request): Promise<Response> {
  initObservability()
  setSnapshotReporter(captureException)
  try {
    const storage = await createNetlifyBlobsStorage()
    return await makeRetrieveHandler(storage)(req)
  } catch (error) {
    captureException(error, { fn: 'snapshot-retrieve' })
    return new Response('Internal Server Error', { status: 500 })
  }
}
