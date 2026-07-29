import { afterEach, beforeAll, describe, expect, test } from 'bun:test'
import { SalvageUnionReference } from 'salvageunion-reference'

import { buttonInteractionHandlerFor } from './helpers.js'
import { gamesCommand, meCommand, shelfCommand } from '../commands/account.js'
import { crewCommand, sheetCommand } from '../commands/crew.js'
import { gameCommand } from '../commands/game.js'
import { setItunClientForTests } from '../commands/itunReply.js'
import { rollCommand } from '../commands/roll.js'
import { suCommand } from '../commands/su.js'
import type { ItunClient } from '../itun/client.js'
import type { ItunResult } from '../itun/types.js'
import { fakeAutocomplete, fakeExecute } from './fakeInteraction.js'

/**
 * The Game commands with an ITUN deployment configured.
 *
 * Everything here goes through the named test seam in `itunReply.ts` rather
 * than through environment variables or `mock.module` — see that function's
 * comment for why neither works. `afterEach` restores Solo, which is what every
 * other test file expects to see.
 */

beforeAll(async () => {
  await SalvageUnionReference.preload('all')
})

let restore: (() => void) | null = null
afterEach(() => {
  restore?.()
  restore = null
})

/** A client whose every method returns the same canned result. */
function clientReturning(result: ItunResult<unknown>): ItunClient {
  const answer = () => Promise.resolve(result) as never
  return {
    me: answer,
    games: answer,
    shelf: answer,
    channel: answer,
    crew: answer,
    sheet: answer,
    bind: answer,
    unbind: answer,
    recordRoll: answer,
  }
}

function connect(result: ItunResult<unknown>): void {
  restore = setItunClientForTests(clientReturning(result))
}

const OK_ME = {
  kind: 'ok' as const,
  value: {
    ok: true,
    user: { userId: 'u1', displayName: 'alxjrvs', avatarUrl: null },
    games: [{ gameId: 'g1', name: 'Tenacity', mediator: false, organizer: true }],
  },
}

const OK_CREW = {
  kind: 'ok' as const,
  value: {
    ok: true,
    game: { gameId: 'g1', name: 'Tenacity' },
    viewerId: 'u1',
    pilots: [
      {
        id: 'p1',
        ownerId: 'u1',
        ownerName: 'alxjrvs',
        present: true,
        body: { callsign: 'Rook', currentHp: 6, currentAp: 3 },
      },
    ],
    mechs: [],
    crawler: null,
  },
}

describe('an ephemeral command', () => {
  test('renders its embed into the deferred reply', async () => {
    connect(OK_ME)
    const { interaction, edits, followUps, deferred } = fakeExecute({ subcommand: 'me' })
    await meCommand.execute(interaction)

    expect(deferred.ephemeral).toBe(true)
    expect(edits[0]?.embeds).toHaveLength(1)
    // Personal, so it stays with the person who asked.
    expect(followUps).toHaveLength(0)
  })

  test.each([
    ['games', gamesCommand],
    ['shelf', shelfCommand],
  ])('/su %s renders too', async (name, command) => {
    connect({
      kind: 'ok',
      value: { ok: true, games: [], pilots: [], mechs: [] },
    })
    const { interaction, edits } = fakeExecute({ subcommand: name })
    await command.execute(interaction)
    expect(edits[0]?.embeds).toHaveLength(1)
  })
})

describe('a public command', () => {
  test('posts to the channel and confirms privately', async () => {
    connect(OK_CREW)
    const { interaction, edits, followUps } = fakeExecute({ subcommand: 'crew' })
    await crewCommand.execute(interaction)

    // The board goes to the table; the invoker gets a private receipt.
    expect(followUps[0]?.embeds).toHaveLength(1)
    expect(edits[0]?.content).toBe('Posted to the channel.')
  })

  test('keeps a DENIAL ephemeral even though the command is public', async () => {
    connect({ kind: 'denied', reason: 'not-a-member', message: 'no' })
    const { interaction, edits, followUps } = fakeExecute({ subcommand: 'crew' })
    await crewCommand.execute(interaction)

    // The whole reason the command defers ephemerally and follows up: "you are
    // not a member of this game" is a fact about a person and must never reach
    // the channel.
    expect(followUps).toHaveLength(0)
    expect(edits[0]?.content).toContain('not a member')
  })

  test('reports an outage as an outage, not as a permissions problem', async () => {
    connect({ kind: 'unavailable', message: 'In The Union Now could not be reached.' })
    const { interaction, edits, followUps } = fakeExecute({ subcommand: 'crew' })
    await crewCommand.execute(interaction)

    expect(followUps).toHaveLength(0)
    expect(edits[0]?.content).toContain('could not be reached')
  })
})

describe('/su sheet', () => {
  test('parses the autocomplete value into a table and an id', async () => {
    connect({
      kind: 'ok',
      value: {
        ok: true,
        table: 'pilots',
        id: 'p1',
        ownerName: 'alxjrvs',
        body: { callsign: 'Rook', currentHp: 6 },
      },
    })
    const { interaction, edits } = fakeExecute({
      subcommand: 'sheet',
      strings: { entity: 'pilots:p1' },
    })
    await sheetCommand.execute(interaction)
    expect(edits[0]?.embeds).toHaveLength(1)
  })

  test.each([['just-a-name'], ['pilots:'], ['bogus:p1']])(
    'refuses a hand-typed value (%s) instead of guessing',
    async (typed) => {
      connect(OK_CREW)
      const { interaction, replies, deferred } = fakeExecute({
        subcommand: 'sheet',
        strings: { entity: typed },
      })
      await sheetCommand.execute(interaction)

      // A user can type anything into an autocomplete field, so the value is
      // parsed rather than trusted — and rejected before any network call.
      expect(deferred.called).toBe(false)
      expect(replies[0]?.content).toContain('Pick an entity from the list')
    }
  )

  test('autocomplete offers only what is in this channel’s game', async () => {
    connect(OK_CREW)
    const { interaction, responses } = fakeAutocomplete({ subcommand: 'sheet', focused: 'roo' })
    await sheetCommand.autocomplete(interaction)

    expect(responses[0]).toEqual([{ name: 'Rook — pilot', value: 'pilots:p1' }])
  })

  test('autocomplete stays empty when the call is denied', async () => {
    connect({ kind: 'denied', reason: 'unbound', message: 'no' })
    const { interaction, responses } = fakeAutocomplete({ subcommand: 'sheet' })
    await sheetCommand.autocomplete(interaction)
    // An autocomplete has no way to explain itself; "no options" is the honest
    // rendering of every failure.
    expect(responses[0]).toEqual([])
  })

  test('autocomplete stays empty outside a channel', async () => {
    connect(OK_CREW)
    const { interaction, responses } = fakeAutocomplete({ subcommand: 'sheet', channelId: null })
    await sheetCommand.autocomplete(interaction)
    expect(responses[0]).toEqual([])
  })
})

describe('/su game', () => {
  test('bind announces itself publicly', async () => {
    connect({ kind: 'ok', value: { ok: true, name: 'Tenacity' } })
    const { interaction, edits, followUps } = fakeExecute({
      subcommand: 'bind',
      subcommandGroup: 'game',
      strings: { game: 'g1' },
    })
    await gameCommand.execute(interaction)

    // Binding changes what the channel MEANS for everyone in it, so it does
    // not happen invisibly.
    expect(edits[0]?.content).toContain('Bound to')
    expect(followUps[0]?.content).toContain('now the table for')
  })

  test('bind denied by the Organizer rule says so, and announces nothing', async () => {
    connect({ kind: 'denied', reason: 'forbidden', message: 'no' })
    const { interaction, edits, followUps } = fakeExecute({
      subcommand: 'bind',
      subcommandGroup: 'game',
      strings: { game: 'g1' },
    })
    await gameCommand.execute(interaction)

    expect(edits[0]?.content).toContain('Organizer')
    expect(followUps).toHaveLength(0)
  })

  test('bind reports an outage without announcing anything', async () => {
    connect({ kind: 'unavailable', message: 'unreachable' })
    const { interaction, edits, followUps } = fakeExecute({
      subcommand: 'bind',
      subcommandGroup: 'game',
      strings: { game: 'g1' },
    })
    await gameCommand.execute(interaction)
    expect(edits[0]?.content).toBe('unreachable')
    expect(followUps).toHaveLength(0)
  })

  test('unbind confirms privately', async () => {
    connect({ kind: 'ok', value: { ok: true } })
    const { interaction, edits } = fakeExecute({ subcommand: 'unbind', subcommandGroup: 'game' })
    await gameCommand.execute(interaction)
    expect(edits[0]?.content).toContain('no longer bound')
  })

  test.each([
    ['denied' as const, { kind: 'denied' as const, reason: 'forbidden' as const, message: 'no' }],
    ['unavailable' as const, { kind: 'unavailable' as const, message: 'unreachable' }],
  ])('unbind surfaces a %s result', async (_label, result) => {
    connect(result)
    const { interaction, edits } = fakeExecute({ subcommand: 'unbind', subcommandGroup: 'game' })
    await gameCommand.execute(interaction)
    expect(edits[0]?.content?.length).toBeGreaterThan(0)
  })

  test('info posts the channel card publicly', async () => {
    connect({
      kind: 'ok',
      value: {
        ok: true,
        game: { gameId: 'g1', name: 'Tenacity' },
        members: [
          {
            userId: 'u1',
            displayName: 'alxjrvs',
            present: true,
            mediator: false,
            organizer: true,
          },
        ],
        downtime: { running: false, stepIndex: null, completed: 0, upkeepSpent: false },
      },
    })
    const { interaction, followUps } = fakeExecute({ subcommand: 'info', subcommandGroup: 'game' })
    await gameCommand.execute(interaction)
    expect(followUps[0]?.embeds).toHaveLength(1)
  })

  test('every subcommand needs a channel', async () => {
    connect(OK_ME)
    for (const subcommand of ['bind', 'unbind', 'info']) {
      const { interaction, replies } = fakeExecute({
        subcommand,
        subcommandGroup: 'game',
        channelId: null,
        strings: { game: 'g1' },
      })
      await gameCommand.execute(interaction)
      expect(replies[0]?.content).toContain('has to be run in a channel')
    }
  })

  test('an unknown subcommand in the group throws loudly', async () => {
    connect(OK_ME)
    const { interaction } = fakeExecute({ subcommand: 'nonsense', subcommandGroup: 'game' })
    await expect(gameCommand.execute(interaction)).rejects.toThrow('Unknown /su game subcommand')
  })

  test('autocomplete offers the caller’s own games', async () => {
    connect({
      kind: 'ok',
      value: {
        ok: true,
        games: [
          { gameId: 'g1', name: 'Tenacity', mediator: false, organizer: true },
          { gameId: 'g2', name: 'Ashfall', mediator: true, organizer: false },
        ],
      },
    })
    const { interaction, responses } = fakeAutocomplete({
      subcommand: 'bind',
      subcommandGroup: 'game',
      focused: 'ten',
    })
    await gameCommand.autocomplete(interaction)
    expect(responses[0]).toEqual([{ name: 'Tenacity', value: 'g1' }])
  })

  test('autocomplete stays empty when the call fails', async () => {
    connect({ kind: 'unavailable', message: 'down' })
    const { interaction, responses } = fakeAutocomplete({
      subcommand: 'bind',
      subcommandGroup: 'game',
    })
    await gameCommand.autocomplete(interaction)
    expect(responses[0]).toEqual([])
  })
})

describe('/su dispatch', () => {
  test('routes the game GROUP by its group name, not its leaf', async () => {
    connect({ kind: 'ok', value: { ok: true } })
    // getSubcommand() inside a group returns `unbind`, which would otherwise
    // fall through to the default branch and throw.
    const { interaction, edits } = fakeExecute({ subcommand: 'unbind', subcommandGroup: 'game' })
    await suCommand.execute(interaction)
    expect(edits[0]?.content).toContain('no longer bound')
  })

  test.each([
    ['me', OK_ME],
    ['games', { kind: 'ok' as const, value: { ok: true, games: [] } }],
    ['shelf', { kind: 'ok' as const, value: { ok: true, pilots: [], mechs: [] } }],
    ['crew', OK_CREW],
  ])('routes /su %s', async (subcommand, result) => {
    connect(result)
    const { interaction, edits, followUps } = fakeExecute({ subcommand })
    await suCommand.execute(interaction)
    expect(edits.length + followUps.length).toBeGreaterThan(0)
  })

  test('routes /su sheet', async () => {
    connect({
      kind: 'ok',
      value: { ok: true, table: 'pilots', id: 'p1', ownerName: null, body: { callsign: 'X' } },
    })
    const { interaction, edits } = fakeExecute({
      subcommand: 'sheet',
      strings: { entity: 'pilots:p1' },
    })
    await suCommand.execute(interaction)
    expect(edits[0]?.embeds).toHaveLength(1)
  })

  test('routes sheet autocomplete', async () => {
    connect(OK_CREW)
    const { interaction, responses } = fakeAutocomplete({ subcommand: 'sheet', focused: '' })
    await suCommand.autocomplete(interaction)
    expect(responses[0]).toHaveLength(1)
  })

  test('routes game-group autocomplete', async () => {
    connect({ kind: 'ok', value: { ok: true, games: [] } })
    const { interaction, responses } = fakeAutocomplete({
      subcommand: 'bind',
      subcommandGroup: 'game',
    })
    await suCommand.autocomplete(interaction)
    expect(responses[0]).toEqual([])
  })
})

describe('roll attribution', () => {
  test('a recorded roll gains a footer saying where it landed', async () => {
    connect({ kind: 'ok', value: { ok: true, game: 'Tenacity' } })
    const { interaction, replies, edits } = fakeExecute({
      subcommand: 'roll',
      strings: { table: 'Core Mechanic' },
    })
    await rollCommand.execute(interaction)

    // The roll itself is replied to FIRST and unchanged; the footer is edited
    // afterwards, only once the recording actually landed.
    expect(replies).toHaveLength(1)
    expect(edits).toHaveLength(1)
    const embed = edits[0]?.embeds?.[0] as { data: { footer?: { text: string } } }
    expect(embed.data.footer?.text).toContain('recorded to Tenacity')
  })

  test('an unrecorded roll is left exactly as it was', async () => {
    connect({ kind: 'denied', reason: 'not-a-member', message: 'no' })
    const { interaction, replies, edits } = fakeExecute({
      subcommand: 'roll',
      strings: { table: 'Core Mechanic' },
    })
    await rollCommand.execute(interaction)

    // Silent: the roll still rolled, and naming the reason in a public channel
    // would announce who has an account.
    expect(replies).toHaveLength(1)
    expect(edits).toHaveLength(0)
  })

  test('a thrown client never escapes past the user’s roll', async () => {
    restore = setItunClientForTests({
      ...clientReturning({ kind: 'unavailable', message: 'x' }),
      recordRoll: () => Promise.reject(new Error('network exploded')),
    })
    const { interaction, replies, edits } = fakeExecute({
      subcommand: 'roll',
      strings: { table: 'Core Mechanic' },
    })

    // The user already has their roll by this point, so there is no failure
    // here worth surfacing to them — it goes to Sentry instead.
    await rollCommand.execute(interaction)
    expect(replies).toHaveLength(1)
    expect(edits).toHaveLength(0)
  })

  test('a re-roll button records too', async () => {
    connect({ kind: 'ok', value: { ok: true, game: 'Tenacity' } })
    const { handle, edits } = buttonInteractionHandlerFor('su:roll:Core Mechanic')
    await handle()
    const embed = edits[0]?.embeds?.[0] as { data: { footer?: { text: string } } }
    expect(embed.data.footer?.text).toContain('recorded to Tenacity')
  })

  test('a lookup button is not a roll and records nothing', async () => {
    connect({ kind: 'ok', value: { ok: true, game: 'Tenacity' } })
    const { handle, edits } = buttonInteractionHandlerFor('su:lookup:Core Mechanic')
    await handle()
    expect(edits).toHaveLength(0)
  })
})
