/**
 * snapshot-delete — DELETE /api/snapshots/:id (Netlify adapter)
 *
 * Revokes a published snapshot. The handler lives in
 * `src/lib/snapshot/handlers.ts`; this file supplies Blobs storage and Sentry.
 * See the note in `snapshot-publish.ts` for why the split exists.
 *
 * See ADR-004 for the endpoint's contract, which is unchanged.
 */

import { makeDeleteHandler } from '../../src/lib/snapshot/handlers'
import { setSnapshotReporter } from '../../src/lib/snapshot/report'
import { createNetlifyBlobsStorage } from '../../src/lib/snapshot/storageNetlify'
import { captureException, initObservability } from '../lib/observability'

export { makeDeleteHandler }

/** @public Netlify Functions handler — invoked by the platform, not imported. */
export default async function (req: Request): Promise<Response> {
  initObservability()
  setSnapshotReporter(captureException)
  try {
    const storage = await createNetlifyBlobsStorage()
    return await makeDeleteHandler(storage)(req)
  } catch (error) {
    captureException(error, { fn: 'snapshot-delete' })
    return new Response('Internal Server Error', { status: 500 })
  }
}
