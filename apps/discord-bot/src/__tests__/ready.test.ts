/**
 * ready handler test — on login the bot sets a steady presence so it reads as a
 * live, first-class app ("Playing Salvage Union") rather than an idle script.
 */
import { describe, expect, test } from 'bun:test'
import { ActivityType } from 'discord.js'
import type { Client } from 'discord.js'

import { handleReady } from '../events/ready.js'

type PresenceArg = { status?: string; activities?: { name: string; type: number }[] }

/** Minimal Client<true> stand-in recording the presence set on login. */
function mockClient() {
  const presences: PresenceArg[] = []
  const client = {
    user: {
      tag: 'SalvageUnion#0001',
      setPresence: (presence: PresenceArg) => {
        presences.push(presence)
      },
    },
    guilds: { cache: { size: 3 } },
  } as unknown as Client<true>
  return { client, presences }
}

describe('handleReady', () => {
  test('sets a "Playing Salvage Union" presence on login', () => {
    const { client, presences } = mockClient()
    handleReady(client)
    expect(presences).toHaveLength(1)
    expect(presences[0]!.status).toBe('online')
    expect(presences[0]!.activities?.[0]).toEqual({
      name: 'Salvage Union',
      type: ActivityType.Playing,
    })
  })
})
