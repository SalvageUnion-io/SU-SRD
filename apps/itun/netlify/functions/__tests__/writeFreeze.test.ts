import { afterEach, describe, expect, test } from 'bun:test'
import { FREEZE_ENV, writeFreezeResponse } from '../../lib/writeFreeze'

/**
 * The ADR-033 P6 snapshot write freeze.
 *
 * The freeze exists so that the delta sync's "reconciled to zero" is a proof
 * rather than a coincidence, so these tests are about the two properties that
 * make it trustworthy: it is OFF unless deliberately turned on, and it can be
 * turned back OFF without a code change.
 */

const original = process.env[FREEZE_ENV]

afterEach(() => {
  // Restored rather than deleted-and-forgotten: `process.env` is process-global
  // and Bun runs a workspace's test files in one process, so leaving this set
  // would hand a frozen backend to every file that runs afterwards.
  if (original === undefined) delete process.env[FREEZE_ENV]
  else process.env[FREEZE_ENV] = original
})

describe('writeFreezeResponse', () => {
  test('is off when the variable is absent — the freeze is opt-in', () => {
    delete process.env[FREEZE_ENV]
    expect(writeFreezeResponse()).toBeNull()
  })

  for (const value of ['1', 'true', 'TRUE', '  true  ']) {
    test(`freezes on ${JSON.stringify(value)}`, () => {
      process.env[FREEZE_ENV] = value
      expect(writeFreezeResponse()?.status).toBe(503)
    })
  }

  for (const value of ['', '0', 'false', 'no', 'yes']) {
    // Anything that is not an explicit yes is a no. `yes` is in this list on
    // purpose: an allowlist that quietly grew synonyms would make the OFF state
    // depend on guessing which spellings were remembered.
    test(`does not freeze on ${JSON.stringify(value)}`, () => {
      process.env[FREEZE_ENV] = value
      expect(writeFreezeResponse()).toBeNull()
    })
  }

  test('the variable is read per call, so the freeze can be lifted', () => {
    // The structural guard. A module-scope `process.env` read would capture the
    // value once at import — which passes every test above and still makes the
    // freeze impossible to lift on a warm serverless instance. This is the only
    // test that would fail if someone hoisted the read.
    delete process.env[FREEZE_ENV]
    expect(writeFreezeResponse()).toBeNull()

    process.env[FREEZE_ENV] = '1'
    expect(writeFreezeResponse()?.status).toBe(503)

    delete process.env[FREEZE_ENV]
    expect(writeFreezeResponse()).toBeNull()
  })
})

describe('the frozen response', () => {
  test('says temporary, in both a status code and a header', () => {
    process.env[FREEZE_ENV] = '1'
    const res = writeFreezeResponse()

    // 503 rather than 403/410: the other two tell clients and crawlers the
    // endpoint is permanently gone, which is the opposite of what is true.
    expect(res?.status).toBe(503)
    expect(res?.headers.get('retry-after')).toBe('3600')
  })

  test('is never cached — a cached 503 would outlive the freeze', () => {
    process.env[FREEZE_ENV] = '1'
    expect(writeFreezeResponse()?.headers.get('cache-control')).toBe('no-store')
  })

  test('explains that existing share links still work', async () => {
    process.env[FREEZE_ENV] = '1'
    const body = (await writeFreezeResponse()?.json()) as { error: string; message: string }

    expect(body.error).toBe('snapshot_writes_frozen')
    // Reads are not frozen, and the message must say so — otherwise the natural
    // reading of "sharing is unavailable" is that published links have broken.
    expect(body.message).toContain('Existing share links keep working')
  })

  test('reads as unavailable to probeSnapshotService, which hides the share UI', () => {
    process.env[FREEZE_ENV] = '1'
    const status = writeFreezeResponse()?.status

    // `probeSnapshotService` treats ONLY 405 and 204 as a reachable backend.
    // Pinning that here is what ties the freeze to the client behaviour it is
    // relying on: the affordance disappears rather than failing when pressed.
    expect(status).not.toBe(405)
    expect(status).not.toBe(204)
  })
})
