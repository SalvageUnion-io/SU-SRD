/**
 * snapshot-publish — POST /api/snapshots (Netlify adapter)
 *
 * The handler itself lives in `src/lib/snapshot/handlers.ts`, because ADR-033
 * adds a second host and the logic is shared. This file is the Netlify half:
 * it supplies Blobs storage, installs Sentry, and is what the platform loads.
 *
 * `makePublishHandler` is re-exported so the existing handler tests keep
 * importing it from here — they are testing the behaviour, not the address.
 *
 * See ADR-004 for the endpoint's contract, which is unchanged.
 */

import { makePublishHandler } from '../../src/lib/snapshot/handlers'
import { setSnapshotReporter } from '../../src/lib/snapshot/report'
import { createNetlifyBlobsStorage } from '../../src/lib/snapshot/storageNetlify'
import { captureException, initObservability } from '../lib/observability'

export { makePublishHandler }

/** @public Netlify Functions handler — invoked by the platform, not imported. */
export default async function (req: Request): Promise<Response> {
  initObservability()
  // The shared handlers report through a transport-neutral seam so they can
  // also run on workerd, where @sentry/node does not bundle. Netlify installs
  // the real reporter here.
  setSnapshotReporter(captureException)
  try {
    const storage = await createNetlifyBlobsStorage()
    return await makePublishHandler(storage)(req)
  } catch (error) {
    captureException(error, { fn: 'snapshot-publish' })
    return new Response('Internal Server Error', { status: 500 })
  }
}
