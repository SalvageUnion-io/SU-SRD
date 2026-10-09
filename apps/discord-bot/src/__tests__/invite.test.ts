import { afterEach, describe, expect, test } from 'bun:test'
import { MessageFlags } from 'discord-api-types/v10'
import { inviteCommand } from '../commands/invite.js'
import { setItunClient } from '../commands/itunReply.js'
import type { InvitedResult } from '../inviteContainer.js'
import { buildInviteDm, joinUrl } from '../inviteContainer.js'
import type { ItunClient } from '../itun/client.js'
import { createItunClient } from '../itun/client.js'
import type { InviteResult, ItunResult } from '../itun/types.js'
import { fakeAutocomplete, fakeExecute } from './fakeInteraction.js'

/**
 * `/su invite @user` (ADR-039 §3).
 *
 * The server half — signature, Organizer check, who may redeem — is
 * `apps/itun/test/convex/botInvite.test.ts`. What this file defends is the
 * bot's half: it forwards Discord's signed request **untouched** and never a
 * Discord id of its own, it DMs the person the server named, a refused DM ends
 * with the Organizer holding a link rather than nothing, and every reply stays
 * between the bot and the Organizer.
 */

const SIGNED = {
  body: '{"id":"interaction-1","type":2}',
  signature: 'ab'.repeat(64),
  timestamp: '1700000000',
}

const INVITED: InvitedResult = {
  outcome: 'invited',
  code: 'A1B2C3D4',
  gameName: 'Tenacity',
  invitedBy: 'Vex',
  inviteeDiscordId: 'snowflake-sam',
  inviteeName: 'Sam',
  role: 'player',
  grantCount: 0,
  expiresAt: null,
  reused: false,
  deliver: true,
}

type Calls = {
  invite: unknown[]
  delivery: unknown[][]
}

let restore: (() => void) | null = null
afterEach(() => {
  restore?.()
  restore = null
})

/** Connect a client whose invite answers `result`, recording what it was sent. */
function connect(
  result: ItunResult<InviteResult>,
  games: ItunResult<unknown> | null = null
): Calls {
  const calls: Calls = { invite: [], delivery: [] }
  const unused = () => Promise.reject(new Error('not used by /su invite')) as never
  const client: ItunClient = {
    me: unused,
    games: unused,
    shelf: unused,
    channel: unused,
    crew: unused,
    crewForAutocomplete: unused,
    gamesForAutocomplete: () => Promise.resolve(games) as never,
    sheet: unused,
    bind: unused,
    unbind: unused,
    recordRoll: unused,
    invite: (signed) => {
      calls.invite.push(signed)
      return Promise.resolve(result)
    },
    inviteDelivery: (...args) => {
      calls.delivery.push(args)
      return Promise.resolve({ kind: 'ok', value: {} })
    },
  }
  restore = setItunClient(client)
  return calls
}

function run(options: Parameters<typeof fakeExecute>[0] = {}) {
  return fakeExecute({ subcommand: 'invite', userId: 'snowflake-vex', signed: SIGNED, ...options })
}

describe('/su invite', () => {
  test('with In The Union Now unavailable it explains itself, privately', async () => {
    const fake = run()
    await inviteCommand.execute(fake.interaction)

    expect(fake.deferred).toEqual({ called: true, ephemeral: true })
    expect(fake.edits[0]?.content).toContain('In The Union Now is not configured')
    expect(fake.directMessages).toHaveLength(0)
  })

  test('forwards Discord’s signed request untouched — never an id of its own', async () => {
    const calls = connect({ kind: 'ok', value: INVITED })
    await inviteCommand.execute(run().interaction)

    expect(calls.invite).toEqual([SIGNED])
  })

  test('with nothing signed behind it, it asks the server for nothing', async () => {
    const calls = connect({ kind: 'ok', value: INVITED })
    const fake = run({ signed: null })
    await inviteCommand.execute(fake.interaction)

    expect(calls.invite).toHaveLength(0)
    expect(fake.edits[0]?.content).toMatch(/could not be verified/)
  })

  test('DMs the person the server named, a link only they can use', async () => {
    const calls = connect({ kind: 'ok', value: INVITED })
    const fake = run()
    await inviteCommand.execute(fake.interaction)

    expect(fake.directMessages).toHaveLength(1)
    const dm = fake.directMessages[0]
    expect(dm?.userId).toBe('snowflake-sam')
    expect(dm?.payload.flags).toBe(MessageFlags.IsComponentsV2)
    expect(JSON.stringify(dm?.payload.components)).toContain(
      'https://intheunionnow.com/join/A1B2C3D4'
    )

    expect(calls.delivery).toEqual([['snowflake-vex', 'A1B2C3D4', 'sent', undefined]])
    expect(fake.edits.at(-1)?.content).toMatch(/Invited \*\*Sam\*\* to \*\*Tenacity\*\*/)
    expect(fake.edits.at(-1)?.content).toMatch(/sent them a DM/)
  })

  test('a refused DM leaves the Organizer holding the link, and the list says so', async () => {
    const calls = connect({ kind: 'ok', value: INVITED })
    const fake = run({ dmOutcome: { ok: false, code: 50007 } })
    await inviteCommand.execute(fake.interaction)

    expect(calls.delivery).toEqual([
      [
        'snowflake-vex',
        'A1B2C3D4',
        'failed',
        'their DMs are closed, or they share no server with the bot',
      ],
    ])
    const reply = fake.edits.at(-1)?.content ?? ''
    expect(reply).toContain('couldn’t DM them')
    expect(reply).toContain('https://intheunionnow.com/join/A1B2C3D4')
    // Never posted to the channel on anyone's behalf.
    expect(fake.followUps).toHaveLength(0)
    expect(fake.replies).toHaveLength(0)
  })

  test('a re-sent invite says it was re-sent', async () => {
    connect({ kind: 'ok', value: { ...INVITED, reused: true } })
    const fake = run()
    await inviteCommand.execute(fake.interaction)
    expect(fake.edits.at(-1)?.content).toMatch(/already had an invite, so I sent it again/)
  })

  test('someone DMed this invite recently is not DMed again; the Organizer gets the link', async () => {
    const calls = connect({ kind: 'ok', value: { ...INVITED, reused: true, deliver: false } })
    const fake = run()
    await inviteCommand.execute(fake.interaction)

    expect(fake.directMessages).toHaveLength(0)
    expect(calls.delivery).toHaveLength(0)
    const reply = fake.edits.at(-1)?.content ?? ''
    expect(reply).toContain('haven’t sent it again')
    expect(reply).toContain('https://intheunionnow.com/join/A1B2C3D4')
  })

  test('someone already seated is reported, and nobody is DMed', async () => {
    connect({
      kind: 'ok',
      value: { outcome: 'already-member', gameName: 'Tenacity', inviteeName: 'Pat' },
    })
    const fake = run()
    await inviteCommand.execute(fake.interaction)

    expect(fake.directMessages).toHaveLength(0)
    expect(fake.edits.at(-1)?.content).toBe('**Pat** is already in **Tenacity**.')
  })

  test('a refusal is the server’s own words, and nobody is DMed', async () => {
    connect({
      kind: 'denied',
      reason: 'unbound',
      message: 'This channel is not bound to a game. Pick one with the game option.',
    })
    const fake = run()
    await inviteCommand.execute(fake.interaction)

    expect(fake.directMessages).toHaveLength(0)
    expect(fake.edits.at(-1)?.content).toMatch(/Pick one with the game option/)
  })

  test('autocomplete offers only the games the caller organises', async () => {
    connect(
      { kind: 'ok', value: INVITED },
      {
        kind: 'ok',
        value: {
          ok: true,
          games: [
            { gameId: 'g1', name: 'Tenacity', mediator: false, organizer: true },
            { gameId: 'g2', name: 'Someone else’s', mediator: false, organizer: false },
          ],
        },
      }
    )
    const fake = fakeAutocomplete({ subcommand: 'invite', userId: 'snowflake-vex' })
    await inviteCommand.autocomplete(fake.interaction)

    expect(fake.responses).toEqual([[{ name: 'Tenacity', value: 'g1' }]])
  })
})

describe('the DM', () => {
  const NOW = 1_700_000_000_000
  const DAY = 1000 * 60 * 60 * 24

  test('says who, what, which seat and how long — and nothing about the crew', () => {
    const dm = buildInviteDm(
      { ...INVITED, role: 'mediator', grantCount: 2, expiresAt: NOW + 6 * DAY + 1 },
      'https://intheunionnow.com',
      NOW
    )
    const text = JSON.stringify(dm)
    expect(text).toContain('**Vex** invited you to **Tenacity** as its **Mediator**')
    expect(text).toContain('2 characters are waiting for you.')
    expect(text).toContain('It expires in 7 days.')
    expect(text).toContain('yours alone')
  })

  test('under a day left reads as "within a day", never "today"', () => {
    const dm = buildInviteDm({ ...INVITED, expiresAt: NOW + 23 * 60 * 60 * 1000 }, 'https://x', NOW)
    expect(JSON.stringify(dm)).toContain('It expires within a day.')
  })

  test('a Game name cannot restyle the message', () => {
    const dm = buildInviteDm({ ...INVITED, gameName: '**loud**' }, 'https://x', NOW)
    expect(JSON.stringify(dm)).toContain('\\\\*\\\\*loud\\\\*\\\\*')
  })

  test('the button opens the join page', () => {
    expect(joinUrl('https://intheunionnow.com/', 'A1B2C3D4')).toBe(
      'https://intheunionnow.com/join/A1B2C3D4'
    )
    const dm = buildInviteDm(INVITED, 'https://intheunionnow.com', NOW)
    expect(dm.blocks.at(-1)).toEqual({
      kind: 'buttons',
      buttons: [
        { kind: 'link', url: 'https://intheunionnow.com/join/A1B2C3D4', label: 'Open invite' },
      ],
    })
  })
})

describe('the transport for a signed op', () => {
  const realFetch = globalThis.fetch
  afterEach(() => {
    globalThis.fetch = realFetch
  })

  test('posts Discord’s bytes verbatim with Discord’s signature headers', async () => {
    const calls: { url: string; init: RequestInit }[] = []
    globalThis.fetch = ((url: string, init: RequestInit) => {
      calls.push({ url, init })
      return Promise.resolve(new Response(JSON.stringify({ ok: true, ...INVITED })))
    }) as unknown as typeof fetch

    const client = createItunClient({ siteUrl: 'https://x.convex.site', botSecret: 'shh' })
    const result = await client.invite(SIGNED)

    expect(result.kind).toBe('ok')
    expect(calls[0]?.url).toBe('https://x.convex.site/bot/invite')
    // Exactly the string received: a parse-and-stringify would break the signature.
    expect(calls[0]?.init.body).toBe(SIGNED.body)
    const headers = calls[0]?.init.headers as Record<string, string>
    expect(headers['X-Signature-Ed25519']).toBe(SIGNED.signature)
    expect(headers['X-Signature-Timestamp']).toBe(SIGNED.timestamp)
    expect(headers.Authorization).toBe('Bearer shh')
  })
})
