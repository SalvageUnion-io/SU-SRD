/**
 * The hourly sign-in health check (`convex/authHealth.ts`).
 *
 * It exists because from 2026-10-06 to 2026-10-09 every sign-in failed and
 * nothing alerted. Its single job is to throw when sign-in is broken, and to
 * stay quiet otherwise. A check that throws on an ordinary quiet hour would get
 * muted, and a muted check is no check at all, so the quiet cases matter as much
 * as the failing one.
 */

import { afterEach, describe, expect, setSystemTime, test } from 'bun:test'
import { internal } from '../../convex/_generated/api'
import { FAILING_ATTEMPTS, IN_FLIGHT_MS, signInFailing, WINDOW_MS } from '../../convex/authHealth'
import { testConvex } from './harness'

const NOW = Date.UTC(2026, 9, 9, 12, 0, 0)
const MINUTE = 60 * 1000

afterEach(() => {
  setSystemTime()
})

type T = ReturnType<typeof testConvex>

/** A sign-in that reached Discord and never came back: a signed verifier. */
async function strandedAttempt(t: T, minutesAgo: number) {
  setSystemTime(NOW - minutesAgo * MINUTE)
  await t.run((ctx) => ctx.db.insert('authVerifiers', { signature: `sig-${minutesAgo}` }))
}

/** A sign-in that never reached Discord: a verifier with no signature. */
async function unsignedVerifier(t: T, minutesAgo: number) {
  setSystemTime(NOW - minutesAgo * MINUTE)
  await t.run((ctx) => ctx.db.insert('authVerifiers', {}))
}

/** A sign-in that completed: a session. */
async function completedSignIn(t: T, minutesAgo: number) {
  setSystemTime(NOW - minutesAgo * MINUTE)
  await t.run(async (ctx) => {
    const userId = await ctx.db.insert('users', { name: 'Salvager', displayName: 'Salvager' })
    await ctx.db.insert('authSessions', { userId, expirationTime: NOW + WINDOW_MS })
  })
}

async function runCheck(t: T) {
  setSystemTime(NOW)
  return t.action(internal.authHealth.check, {})
}

describe('the decision', () => {
  test('fails only with enough stranded attempts and no completed sign-in', () => {
    expect(signInFailing({ stranded: FAILING_ATTEMPTS, completed: 0 })).toBe(true)
    expect(signInFailing({ stranded: FAILING_ATTEMPTS - 1, completed: 0 })).toBe(false)
    expect(signInFailing({ stranded: 50, completed: 1 })).toBe(false)
    expect(signInFailing({ stranded: 0, completed: 0 })).toBe(false)
  })
})

describe('the hourly check against the database', () => {
  test('throws when attempts reach Discord and none complete — the 2026-10-06 outage', async () => {
    const t = testConvex()
    for (const minutesAgo of [30, 90, 200, 300]) await strandedAttempt(t, minutesAgo)

    await expect(runCheck(t)).rejects.toThrow('Discord sign-in is failing: 4 attempts')
  })

  test('stays quiet when someone signed in, despite abandoned attempts', async () => {
    const t = testConvex()
    for (const minutesAgo of [30, 90, 200, 250, 300]) await strandedAttempt(t, minutesAgo)
    await completedSignIn(t, 120)

    expect(await runCheck(t)).toEqual({ stranded: 5, completed: 1 })
  })

  test('stays quiet on a quiet hour with nobody signing in', async () => {
    const t = testConvex()

    expect(await runCheck(t)).toEqual({ stranded: 0, completed: 0 })
  })

  test('ignores attempts still in flight: the user may be on the consent screen', async () => {
    const t = testConvex()
    const inFlight = IN_FLIGHT_MS / MINUTE - 1
    for (let i = 0; i < FAILING_ATTEMPTS; i++) await strandedAttempt(t, inFlight - i)

    expect(await runCheck(t)).toEqual({ stranded: 0, completed: 0 })
  })

  test('ignores attempts older than the window', async () => {
    const t = testConvex()
    const tooOld = WINDOW_MS / MINUTE + 5
    for (let i = 0; i < FAILING_ATTEMPTS; i++) await strandedAttempt(t, tooOld + i)

    expect(await runCheck(t)).toEqual({ stranded: 0, completed: 0 })
  })

  test('ignores verifiers that never reached Discord', async () => {
    // No signature means the signin route never ran, so the callback was
    // never tried and says nothing about whether it works.
    const t = testConvex()
    for (const minutesAgo of [30, 90, 200, 300]) await unsignedVerifier(t, minutesAgo)

    expect(await runCheck(t)).toEqual({ stranded: 0, completed: 0 })
  })
})
