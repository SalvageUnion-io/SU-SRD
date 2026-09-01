/**
 * `runWrite` — the one place a fire-and-forget sheet write's failure is caught.
 *
 * The defect it replaces was `void store.update(...)`: a rejected promise with
 * nothing attached to it, which is an unhandled rejection and, to the player, a
 * control that does nothing and says nothing. So the property under test is not
 * "it toasts" (that is sonner's job) but "nothing escapes" — for a rejection AND
 * for a synchronous throw, which an injected store can produce.
 */

import { afterEach, describe, expect, test } from 'bun:test'
import { toast } from 'component-lib'
import { WritesBlockedOffline } from '../../../stores/entityBackend'
import { reportWriteFailure, runWrite } from '../sheetWrite'

const realError = console.error

afterEach(() => {
  console.error = realError
  // `reportWriteFailure` raises a REAL sonner toast, and sonner's store is a
  // process-global `Observer` whose `subscribe` REPLAYS every still-active
  // toast into the next `<Toaster/>` mounted anywhere in the process. This file
  // mounts none, so the four toasts it raises reached no subscriber and were
  // never dismissed — they simply waited.
  //
  // `ActiveItemBand.writesBlocked.test.tsx` mounts a `<Toaster/>` and asserts on
  // the offline refusal copy, which is byte-identical to the one raised here.
  // It inherited this file's stale copy, found two matching elements, and —
  // because `findByText` retries a multiple-match throw rather than surfacing it
  // — spent the full 1000 ms `waitFor` budget and reported as a timeout. Same
  // module-global hazard as `mock.module`, different module.
  toast.dismiss()
})

/** Collects anything the process would have reported as unhandled. */
function withUnhandledCapture<T>(run: () => T): { result: T; unhandled: unknown[] } {
  const unhandled: unknown[] = []
  const onUnhandled = (err: unknown) => unhandled.push(err)
  process.on('unhandledRejection', onUnhandled)
  try {
    return { result: run(), unhandled }
  } finally {
    process.off('unhandledRejection', onUnhandled)
  }
}

describe('runWrite', () => {
  test('a blocked write is swallowed, not left unhandled', async () => {
    const { unhandled } = withUnhandledCapture(() => {
      runWrite(() => Promise.reject(new WritesBlockedOffline()))
    })
    // Give the microtask queue and one macrotask turn to report a leak.
    await new Promise((r) => setTimeout(r, 10))
    expect(unhandled).toHaveLength(0)
  })

  test('a synchronous throw is caught too', () => {
    // An injected test store — or any plain function — may throw rather than
    // reject, and an uncaught throw here takes out the click handler.
    const seen: unknown[] = []
    console.error = (...args: unknown[]) => seen.push(args)
    expect(() =>
      runWrite(() => {
        throw new Error('boom')
      })
    ).not.toThrow()
    expect(seen).toHaveLength(1)
  })

  test('an unexpected failure keeps its console trace', () => {
    // A blocked write is expected and needs no stack; anything else is a bug and
    // must stay diagnosable even though the player only sees a short message.
    const seen: unknown[] = []
    console.error = (...args: unknown[]) => seen.push(args)
    reportWriteFailure(new Error('schema exploded'))
    expect(seen).toHaveLength(1)
  })

  test('a blocked write does NOT log to the console', () => {
    const seen: unknown[] = []
    console.error = (...args: unknown[]) => seen.push(args)
    reportWriteFailure(new WritesBlockedOffline('settling'))
    expect(seen).toHaveLength(0)
  })
})
