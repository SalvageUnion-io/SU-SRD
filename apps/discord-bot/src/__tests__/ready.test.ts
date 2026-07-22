/**
 * ready handler test — on login the bot sets a steady presence so it reads as a
 * live, first-class app ("Playing Salvage Union") rather than an idle script.
 *
 * ready.ts now imports observability.ts, which transitively imports config.ts
 * (which throws when DISCORD_TOKEN is unset), so we set the env and import it
 * dynamically after — same pattern as interactionCreate.test.ts.
 */
import { beforeAll, describe, expect, test } from 'bun:test'
import { ActivityType } from 'discord.js'
import type { ReadyClient } from '../events/ready.js'

process.env.DISCORD_TOKEN ??= 'test-token'
process.env.DISCORD_CLIENT_ID ??= 'test-client-id'

let handleReady: typeof import('../events/ready.js').handleReady

beforeAll(async () => {
  ;({ handleReady } = await import('../events/ready.js'))
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
  const client: ReadyClient = {
    user: {
      tag: 'SalvageUnion#0001',
      setPresence: (presence: PresenceArg) => {
        presences.push(presence)
      },
    },
    guilds: { cache: { size: 3 } },
  }
  return { client, presences }
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
})
