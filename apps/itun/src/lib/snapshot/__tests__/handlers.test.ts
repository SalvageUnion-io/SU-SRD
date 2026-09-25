/**
 * The publish handler's storage-fault path.
 *
 * `generateUniqueId` probes storage for each candidate id, so a throw there is
 * an R2 fault. It used to be a bare `catch {}` that answered 500 and told
 * nobody (audit AP-15), while the put/get/delete faults beside it were
 * reported. This pins that it is reported like its siblings.
 */

import { afterEach, describe, expect, it } from 'bun:test'
import { pilotFixture } from '../../../components/__tests__/fixtures'
import { makePublishHandler } from '../handlers'
import { setSnapshotReporter } from '../report'
import type { SnapshotStorage } from '../storage'

const unreachable: SnapshotStorage = {
  get: () => Promise.reject(new Error('R2 unavailable')),
  put: () => Promise.reject(new Error('unreachable: get fails first')),
  delete: () => Promise.resolve(),
}

function publishRequest(): Request {
  return new Request('https://example.test/api/snapshots', {
    method: 'POST',
    body: JSON.stringify({ kind: 'pilot', entity: pilotFixture({ id: 'p1' }) }),
  })
}

afterEach(() => {
  setSnapshotReporter(() => undefined)
})

describe('makePublishHandler — id generation fault', () => {
  it('answers 500 and reports the storage error', async () => {
    const reports: Array<{ error: unknown; context?: Record<string, unknown> }> = []
    setSnapshotReporter((error, context) => {
      reports.push({ error, context })
    })

    const res = await makePublishHandler(unreachable)(publishRequest())

    expect(res.status).toBe(500)
    expect(reports).toHaveLength(1)
    expect(reports[0]?.error).toBeInstanceOf(Error)
    expect(String(reports[0]?.error)).toContain('R2 unavailable')
    expect(reports[0]?.context).toEqual({ fn: 'snapshot-publish', op: 'generateUniqueId' })
  })
})
