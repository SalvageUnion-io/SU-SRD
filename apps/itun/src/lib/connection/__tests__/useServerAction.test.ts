/**
 * `useServerAction` — the one way a component runs a write it waits on.
 *
 * What is pinned is what a hand-rolled call site gets wrong: the press is pending until the write settles, a refusal says the
 * server's words, a blocked write says the store's, and a defect says the
 * caller's line — never the text it was thrown with, which for a Convex write
 * is the redacted `[CONVEX M(fn)] … Server Error`. And `run` never rejects, so
 * nothing escapes as an unhandled rejection.
 */

import { afterAll, afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { act, renderHook } from '@testing-library/react'
import { toast } from 'component-lib'
import { ConvexError } from 'convex/values'
import { installConvexMocks } from '../../../components/__tests__/convexMock'
import type { ServerActionResult } from '../useServerAction'

/** Every `captureException` the hook made — what Sentry would have heard. */
const captured: unknown[] = []

// Spread before anything is mocked: every other export stays real.
const realObservability = { ...(await import('../../observability')) }

// Module scope, before the imports below: `mock.module` only affects imports
// that resolve after it runs. `also` specifiers resolve from convexMock.ts.
const convexMocks = await installConvexMocks({
  also: {
    '../../lib/observability': () => ({
      ...realObservability,
      captureException: (error: unknown) => {
        captured.push(error)
      },
    }),
  },
})

const { WritesBlockedOffline } = await import('../../../stores/entityBackend')
const { LinkRefused } = await import('../../links/linkRefused')
const { failureMessage, useServerAction } = await import('../useServerAction')

const FAILURE = 'That could not be saved. Try again.'

class FileRefused extends Error {}

// sonner's store is process-global and replays a live toast into the next
// <Toaster/> mounted anywhere in the run (see runWrite.test.ts).
afterEach(() => {
  toast.dismiss()
})

beforeEach(() => {
  captured.length = 0
})

afterAll(() => {
  convexMocks.restore()
})

describe('failureMessage', () => {
  test("a refusal says the server's words", () => {
    expect(failureMessage(new ConvexError('Only the Organiser can do that.'), FAILURE)).toBe(
      'Only the Organiser can do that.'
    )
  })

  test("a defect says the caller's line, never its own text", () => {
    const redacted = new Error('[CONVEX M(games:create)] [Request ID: 1] Server Error')
    expect(failureMessage(redacted, FAILURE)).toBe(FAILURE)
  })

  test("the store's player-facing failures keep their words", () => {
    expect(failureMessage(new WritesBlockedOffline(), FAILURE)).toBe(
      new WritesBlockedOffline().message
    )
    expect(failureMessage(new LinkRefused('That NPC is in another Game.'), FAILURE)).toBe(
      'That NPC is in another Game.'
    )
  })

  test('a call site names its own player-facing errors', () => {
    expect(failureMessage(new FileRefused('Not a backup.'), FAILURE)).toBe(FAILURE)
    expect(failureMessage(new FileRefused('Not a backup.'), FAILURE, [FileRefused])).toBe(
      'Not a backup.'
    )
  })
})

// A caught error never reaches Sentry's global handler, so whether a failure
// is reported is decided here: a defect is, once; anything with words written
// for the player was meant to happen and is not.
describe('what Sentry hears', () => {
  test('a defect is reported once', () => {
    const defect = new Error('[CONVEX M(games:create)] [Request ID: 1] Server Error')
    failureMessage(defect, FAILURE)
    expect(captured).toEqual([defect])
  })

  test('a refusal, a blocked or refused write, and a named player error are not', () => {
    failureMessage(new ConvexError('Only the Organiser can do that.'), FAILURE)
    failureMessage(new WritesBlockedOffline(), FAILURE)
    failureMessage(new LinkRefused('That NPC is in another Game.'), FAILURE)
    failureMessage(new FileRefused('Not a backup.'), FAILURE, [FileRefused])
    expect(captured).toEqual([])
  })

  test('a defect through run is reported', async () => {
    const defect = new Error('boom')
    await runOnce(() => Promise.reject(defect))
    expect(captured).toEqual([defect])
  })

  test('a refusal through run is not', async () => {
    await runOnce(async () => {
      throw new ConvexError('That invite has expired.')
    })
    expect(captured).toEqual([])
  })
})

/** Run `write` through the hook once, settling every update inside act(). */
async function runOnce<R>(write: () => Promise<R>, toastId?: string) {
  const hook = renderHook(() => useServerAction(write, { failure: FAILURE, toastId }))
  let result: ServerActionResult<R> | undefined
  await act(async () => {
    result = await hook.result.current.run()
  })
  return { hook, result }
}

describe('useServerAction', () => {
  test('a write that lands hands back its value and leaves no error', async () => {
    const { hook, result } = await runOnce(async () => 'game-1')
    expect(result).toEqual({ ok: true, value: 'game-1' })
    expect(hook.result.current.error).toBeNull()
    expect(hook.result.current.pending).toBe(false)
  })

  test('is pending from the press until the write settles', async () => {
    let land: (value: string) => void = () => {}
    const hook = renderHook(() =>
      useServerAction(() => new Promise<string>((resolve) => (land = resolve)), {
        failure: FAILURE,
      })
    )
    let running: Promise<ServerActionResult<string>> = Promise.resolve({ ok: false, error: '' })
    act(() => {
      running = hook.result.current.run()
    })
    expect(hook.result.current.pending).toBe(true)
    await act(async () => {
      land('done')
      await running
    })
    expect(hook.result.current.pending).toBe(false)
  })

  test("a refusal is held as the server's words", async () => {
    const { hook, result } = await runOnce(async () => {
      throw new ConvexError('That invite has expired.')
    })
    expect(result).toEqual({ ok: false, error: 'That invite has expired.' })
    expect(hook.result.current.error).toBe('That invite has expired.')
  })

  test("a defect, thrown or rejected, is held as the caller's line", async () => {
    const rejected = await runOnce(() => Promise.reject(new Error('Disk full')))
    expect(rejected.hook.result.current.error).toBe(FAILURE)

    const thrown = await runOnce(() => {
      throw new Error('boom')
    })
    expect(thrown.result).toEqual({ ok: false, error: FAILURE })
  })

  test('the next run clears the last failure', async () => {
    let fail = true
    const hook = renderHook(() =>
      useServerAction(
        async () => {
          if (fail) throw new Error('boom')
        },
        { failure: FAILURE }
      )
    )
    await act(async () => {
      await hook.result.current.run()
    })
    expect(hook.result.current.error).toBe(FAILURE)

    fail = false
    await act(async () => {
      await hook.result.current.run()
    })
    expect(hook.result.current.error).toBeNull()
  })

  test('with a toast id the failure is a toast, not a held error', async () => {
    const { hook, result } = await runOnce(() => Promise.reject(new Error('boom')), 'test-toast')
    expect(result).toEqual({ ok: false, error: FAILURE })
    expect(hook.result.current.error).toBeNull()
  })
})
