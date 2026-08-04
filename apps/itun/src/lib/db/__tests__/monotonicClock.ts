/**
 * A deterministic wall clock for the tests that care about record ordering.
 *
 * `crud.ts` stamps `createdAt` / `updatedAt` with `new Date().toISOString()`,
 * and `list()` sorts on `createdAt`. Tests that wanted two records in a known
 * order used to sleep 5ms between the writes and hope the clock had ticked —
 * fourteen of them, betting on host clock resolution and paying ~70ms per run
 * for the privilege. Worse, they were flaky *by construction*: a coarse timer
 * makes two writes share a millisecond and the ordering assertion fails for a
 * reason that has nothing to do with the code under test.
 *
 * There is no injectable now-source in the db layer (that would be a
 * production API change on the write path of every entity), so this replaces
 * the global instead — narrowly:
 *
 *  - `new Date()` (no args) returns the cursor and advances it.
 *  - `Date.now()` does the same.
 *  - **Every other form is untouched.** `new Date(isoString)` still parses,
 *    which is what `crud.ts`'s sort and every assertion here rely on, and
 *    instances are real `Date`s (`Reflect.construct` on the original), so
 *    `instanceof` and structured-clone into fake-indexeddb both still work.
 *
 * Install in `beforeAll` and restore in `afterAll` — `globalThis.Date` is
 * process-wide, so a clock left installed follows every later test file.
 */

const REAL_DATE = Date

export type MonotonicClock = {
  /** Put the real `Date` back. Always call this — the global is process-wide. */
  restore: () => void
  /** Jump the cursor forward, e.g. to test an explicitly stale record. */
  advance: (ms: number) => void
  /** The value the next zero-arg `new Date()` / `Date.now()` will report. */
  peek: () => number
}

export type MonotonicClockOptions = {
  /** Epoch ms the first reading reports. Default: 2026-01-01T00:00:00Z. */
  start?: number
  /** How far each reading advances the cursor. Default: 1000ms. */
  stepMs?: number
}

/**
 * Freeze `Date` to a counter that advances one step per reading, so two
 * consecutive writes are guaranteed distinct and ordered with no sleeping.
 */
export function installMonotonicClock(options: MonotonicClockOptions = {}): MonotonicClock {
  let cursor = options.start ?? REAL_DATE.parse('2026-01-01T00:00:00.000Z')
  const step = options.stepMs ?? 1000

  function tick(): number {
    const at = cursor
    cursor += step
    return at
  }

  const patched = new Proxy(REAL_DATE, {
    construct(target, args, newTarget) {
      if (args.length === 0) return Reflect.construct(target, [tick()], newTarget)
      return Reflect.construct(target, args, newTarget)
    },
    get(target, prop, receiver) {
      if (prop === 'now') return tick
      return Reflect.get(target, prop, receiver)
    },
  })

  globalThis.Date = patched

  return {
    restore() {
      globalThis.Date = REAL_DATE
    },
    advance(ms: number) {
      cursor += ms
    },
    peek() {
      return cursor
    },
  }
}
