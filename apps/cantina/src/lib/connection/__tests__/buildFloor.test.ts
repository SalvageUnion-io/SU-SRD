/**
 * The build floor's decisions: when a bundle is outdated, and how an outdated
 * tab waits for the Worker before it reloads. The loop is driven by hand — a
 * recorded `schedule` instead of timers — so the backoff and the no-reload-loop
 * property are asserted without sleeping.
 */
import { describe, expect, it } from 'bun:test'
import { FIRST_PROBE_MS, isOutdated, MAX_PROBE_MS, reloadOnceServed } from '../buildFloor'

describe('isOutdated', () => {
  it('is true only when the floor is newer than the bundle', () => {
    expect(isOutdated(200, 100)).toBe(true)
    expect(isOutdated(100, 100)).toBe(false)
    expect(isOutdated(50, 100)).toBe(false)
  })

  it('never refuses before the floor has loaded', () => {
    expect(isOutdated(undefined, 100)).toBe(false)
  })
})

/** Runs `reloadOnceServed` with the server's answers queued and timers recorded. */
function drive(answers: boolean[]) {
  const delays: number[] = []
  const pending: Array<() => void> = []
  let reloads = 0
  const cancel = reloadOnceServed(
    async () => answers.shift() ?? false,
    () => {
      reloads += 1
    },
    (run, ms) => {
      delays.push(ms)
      pending.push(run)
      return () => {
        pending.length = 0
      }
    }
  )
  /** Lets the in-flight ask answer. */
  const settle = async () => {
    await Promise.resolve()
    await Promise.resolve()
  }
  /** Settles the in-flight ask, then fires the next scheduled one. */
  const step = async () => {
    await settle()
    pending.shift()?.()
  }
  return {
    delays,
    cancel,
    settle,
    step,
    get reloads() {
      return reloads
    },
  }
}

describe('reloadOnceServed', () => {
  it('does not reload while the Worker still serves this build', async () => {
    // The Convex push lands before the Worker deploy: the floor has moved but
    // the shell is still this page's. Reloading now would boot the same build,
    // find it outdated again, and reload again — a loop.
    const h = drive([false, false, false])
    await h.step()
    await h.step()
    await h.step()
    expect(h.reloads).toBe(0)
  })

  it('backs off between asks, up to a ceiling', async () => {
    const h = drive(Array.from({ length: 8 }, () => false))
    for (let i = 0; i < 8; i++) await h.step()
    expect(h.delays.slice(0, 3)).toEqual([FIRST_PROBE_MS, FIRST_PROBE_MS * 2, FIRST_PROBE_MS * 4])
    expect(Math.max(...h.delays)).toBe(MAX_PROBE_MS)
  })

  it('reloads once, as soon as the Worker serves another build', async () => {
    const h = drive([false, true])
    await h.step()
    await h.step()
    await h.step()
    expect(h.reloads).toBe(1)
    expect(h.delays).toHaveLength(1)
  })

  it('stops asking when cancelled', async () => {
    // Unmounted (or no longer outdated) while waiting out a backoff step.
    const h = drive([false, true])
    await h.settle()
    expect(h.delays).toEqual([FIRST_PROBE_MS])
    h.cancel()
    await h.step()
    await h.step()
    expect(h.reloads).toBe(0)
  })
})
