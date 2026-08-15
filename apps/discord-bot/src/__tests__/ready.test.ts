/**
 * ready handler test — on login the bot sets a steady presence so it reads as a
 * live, first-class app ("Playing Salvage Union") rather than an idle script.
 *
 * ready.ts now imports observability.ts, which transitively imports config.ts
 * (which throws when DISCORD_TOKEN is unset), so we set the env and import it
 * dynamically after — same pattern as interactionCreate.test.ts.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, mock, test } from 'bun:test'
import { ActivityType } from 'discord.js'
import type { ReadyClient } from '../events/ready.js'

process.env.DISCORD_TOKEN ??= 'test-token'
process.env.DISCORD_CLIENT_ID ??= 'test-client-id'

/**
 * Records what `handleReady` asks of observability.
 *
 * `mock.module` is process-global in Bun, so the real namespace is captured
 * BEFORE mocking and restored in `afterAll` — see
 * `.claude/rules/testing-patterns.md`. The spread is load-bearing: a module
 * namespace is a live view, so holding it unspread would read as the mock by
 * the time `afterAll` runs.
 */
const observabilityCalls: string[] = []
let heartbeatIsAlive: (() => boolean) | null = null
const realObservability = { ...(await import('../observability.js')) }

mock.module('../observability.js', () => ({
  ...realObservability,
  startLivenessHeartbeat: (isAlive: () => boolean) => {
    observabilityCalls.push('startLivenessHeartbeat')
    heartbeatIsAlive = isAlive
  },
}))

let handleReady: typeof import('../events/ready.js').handleReady

beforeAll(async () => {
  ;({ handleReady } = await import('../events/ready.js'))
})

afterAll(() => {
  mock.module('../observability.js', () => realObservability)
})

beforeEach(() => {
  observabilityCalls.length = 0
})

// A structural SUPERTYPE of discord.js's PresenceData, so the recording mock
// satisfies handleReady's narrow ReadyClient surface with no forced cast.
type PresenceArg = {
  status?: string
  activities?: readonly { name: string; type?: number }[]
}

/** Minimal ReadyClient stand-in recording the presence set on login. */
function mockClient() {
  const presences: PresenceArg[] = []
  let ready = true
  const client: ReadyClient = {
    user: {
      tag: 'SalvageUnion#0001',
      setPresence: (presence: PresenceArg) => {
        presences.push(presence)
      },
    },
    guilds: { cache: { size: 3 } },
    isReady: () => ready,
  }
  return {
    client,
    presences,
    disconnect: () => {
      ready = false
    },
  }
}

describe('handleReady', () => {
  test('sets a "Playing Salvage Union" presence on login', () => {
    const { client, presences } = mockClient()
    handleReady(client)
    expect(presences).toHaveLength(1)
    expect(presences[0]?.status).toBe('online')
    expect(presences[0]?.activities?.[0]).toEqual({
      name: 'Salvage Union',
      type: ActivityType.Playing,
    })
  })

  test('starts the liveness heartbeat, and sends no info event to do it', () => {
    const { client } = mockClient()
    handleReady(client)

    // The worker's liveness signal is a Sentry cron monitor, where a MISSED
    // check-in raises the alert. It used to be `captureMessage('discord-bot
    // ready')`, which could not alert on a dead worker at all — Sentry fires on
    // events arriving, never on their absence — and instead accrued into a
    // permanent error-category issue that had to be archived (SU-DISCORD-1).
    expect(observabilityCalls).toEqual(['startLivenessHeartbeat'])
    expect(observabilityCalls.some((c) => c.startsWith('captureMessage'))).toBe(false)
  })

  test('the heartbeat asks the LIVE client, not a value captured at login', () => {
    const { client, disconnect } = mockClient()
    handleReady(client)

    expect(heartbeatIsAlive?.()).toBe(true)

    // Reaching handleReady proves the bot connected once. If the predicate had
    // closed over that moment, a worker that stays up after losing its gateway
    // session would report `ok` forever and hold the monitor green through the
    // exact outage it exists to catch.
    disconnect()
    expect(heartbeatIsAlive?.()).toBe(false)
  })
})
