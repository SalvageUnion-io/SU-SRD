import { afterEach, describe, expect, test } from 'bun:test'
import { MessageFlags } from 'discord-api-types/v10'
import { gamesCommand, meCommand } from '../commands/account'
import { parseSheetTarget, sheetCommand } from '../commands/sheet'
import { setSiteClient } from '../commands/siteReply'
import { suCommand } from '../commands/su'
import type { SiteClient } from '../play/client'
import type { SiteResult } from '../play/types'
import type { ReplyArg } from './fakeInteraction'
import { fakeAutocomplete, fakeExecute } from './fakeInteraction'

/**
 * The Game commands with an app deployment configured.
 *
 * Everything here goes through the named test seam in `siteReply.ts` rather
 * than through environment variables or `mock.module` — see that function's
 * comment for why neither works. `afterEach` restores the unconfigured client,
 * which is what every other test file expects to see.
 */

let restore: (() => void) | null = null
afterEach(() => {
  restore?.()
  restore = null
})

/** A client whose every method returns the same canned result. */
function clientReturning(result: SiteResult<unknown>): SiteClient {
  const answer = () => Promise.resolve(result) as never
  return {
    me: answer,
    games: answer,
    mineForAutocomplete: answer,
    sheet: answer,
    gamesForAutocomplete: answer,
    bindChannel: answer,
    unbindChannel: answer,
    usage: answer,
    feedback: answer,
  }
}

function connect(result: SiteResult<unknown>): void {
  restore = setSiteClient(clientReturning(result))
}

/**
 * Assert a recorded reply carried exactly one rendered Game container.
 *
 * The Game surfaces are Components V2, so the payload carries `components`
 * plus the flag and never an embed — V2 is all-in per message.
 */
function expectContainer(reply: ReplyArg | undefined, options: { ephemeral: boolean }): void {
  if (!reply) throw new Error('expected a reply')
  expect(reply.components).toHaveLength(1)
  expect(reply.embeds).toBeUndefined()
  expect(reply.flags).toBe(
    options.ephemeral
      ? MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral
      : MessageFlags.IsComponentsV2
  )
}

const OK_ME = {
  kind: 'ok' as const,
  value: {
    ok: true,
    user: { userId: 'u1', displayName: 'alxjrvs', avatarUrl: null },
    games: [{ gameId: 'g1', name: 'Tenacity', mediator: false, organizer: true }],
  },
}

const OK_MINE = {
  kind: 'ok' as const,
  value: {
    ok: true,
    pilots: [{ id: 'p1', body: { callsign: 'Rook' } }],
    mechs: [{ id: 'm1', body: { name: 'Lantern' } }],
    crawlers: [{ id: 'c1', body: { name: 'The Ossuary' } }],
  },
}

const OK_SHEET = {
  kind: 'ok' as const,
  value: {
    ok: true,
    table: 'pilots',
    id: 'p1',
    appId: 'app-p1',
    ownerName: 'alxjrvs',
    body: { callsign: 'Rook', currentHP: 6 },
  },
}

describe('an ephemeral command', () => {
  test('renders as an ephemeral follow-up, and resolves the placeholder', async () => {
    connect(OK_ME)
    const { interaction, edits, followUps, sent, deferred } = fakeExecute({ subcommand: 'me' })
    await meCommand.execute(interaction)

    expect(deferred.ephemeral).toBe(true)
    // The placeholder is resolved BEFORE the follow-up: sent while it is still
    // "thinking…", Discord turns the follow-up into the placeholder itself,
    // and the edit after it is refused.
    expect(sent).toEqual(['edit', 'followUp'])
    // A follow-up, not an edit: a container needs the V2 flag, and Discord
    // refuses to toggle that onto a placeholder created without it.
    expectContainer(followUps[0], { ephemeral: true })
    // The placeholder must still become something, or it sits on "thinking…".
    expect(edits[0]?.content).toBe('Rendered below.')
    // Personal, so it stays with the person who asked. Both visibilities are
    // follow-ups, so the flag is what keeps this one private.
    for (const followUp of followUps) {
      expect(Number(followUp.flags) & MessageFlags.Ephemeral).toBe(MessageFlags.Ephemeral)
    }
  })

  test('/su games renders too', async () => {
    connect({ kind: 'ok', value: { ok: true, games: [] } })
    const { interaction, followUps } = fakeExecute({ subcommand: 'games' })
    await gamesCommand.execute(interaction)
    expectContainer(followUps[0], { ephemeral: true })
  })

  test('keeps a denial ephemeral and says why', async () => {
    connect({ kind: 'denied', reason: 'not-found', message: 'That sheet could not be found.' })
    const { interaction, edits, followUps } = fakeExecute({
      subcommand: 'sheet',
      strings: { entity: 'pilots:p1' },
    })
    await sheetCommand.execute(interaction)
    expect(followUps).toHaveLength(0)
    expect(edits[0]?.content).toBe('That sheet could not be found.')
  })

  test('reports an outage as an outage, not as a permissions problem', async () => {
    connect({ kind: 'unavailable', message: 'The app could not be reached.' })
    const { interaction, edits, followUps } = fakeExecute({ subcommand: 'me' })
    await meCommand.execute(interaction)
    expect(followUps).toHaveLength(0)
    expect(edits[0]?.content).toContain('could not be reached')
  })
})

describe('/su sheet', () => {
  test('opens a picked entity, privately', async () => {
    let asked: unknown[] = []
    restore = setSiteClient({
      ...clientReturning(OK_SHEET),
      sheet: (...args) => {
        asked = args
        return Promise.resolve(OK_SHEET) as never
      },
    })
    const { interaction, followUps } = fakeExecute({
      subcommand: 'sheet',
      userId: 'discord-me',
      strings: { entity: 'pilots:p1' },
    })
    await sheetCommand.execute(interaction)
    expect(asked).toEqual(['discord-me', 'pilots', 'p1'])
    expectContainer(followUps[0], { ephemeral: true })
  })

  test('opens a pasted link to somebody else’s sheet', async () => {
    let asked: unknown[] = []
    restore = setSiteClient({
      ...clientReturning(OK_SHEET),
      sheet: (...args) => {
        asked = args
        return Promise.resolve(OK_SHEET) as never
      },
    })
    const { interaction, followUps } = fakeExecute({
      subcommand: 'sheet',
      userId: 'discord-me',
      strings: { entity: 'https://salvageunion.io/build/p/mech/app-m9' },
    })
    await sheetCommand.execute(interaction)
    expect(asked).toEqual(['discord-me', 'mechs', 'app-m9'])
    expectContainer(followUps[0], { ephemeral: true })
  })

  test.each([
    ['just-a-name'],
    ['pilots:'],
    ['bogus:p1'],
    ['https://salvageunion.io/build/play/games/g1'],
  ])('refuses a value that is neither a pick nor a sheet link (%s)', async (typed) => {
    connect(OK_SHEET)
    const { interaction, replies, deferred } = fakeExecute({
      subcommand: 'sheet',
      strings: { entity: typed },
    })
    await sheetCommand.execute(interaction)

    // A user can type anything into an autocomplete field, so the value is
    // parsed rather than trusted — and rejected before any network call.
    expect(deferred.called).toBe(false)
    expect(replies[0]?.content).toContain('paste a link to a sheet')
  })

  test('autocomplete offers your own pilots, mechs and crawlers', async () => {
    connect(OK_MINE)
    const all = fakeAutocomplete({ subcommand: 'sheet', focused: '' })
    await sheetCommand.autocomplete(all.interaction)
    expect(all.responses[0]).toEqual([
      { name: 'Rook — pilot', value: 'pilots:p1' },
      { name: 'Lantern — mech', value: 'mechs:m1' },
      { name: 'The Ossuary — crawler', value: 'crawlers:c1' },
    ])

    const some = fakeAutocomplete({ subcommand: 'sheet', focused: 'roo' })
    await sheetCommand.autocomplete(some.interaction)
    expect(some.responses[0]).toEqual([{ name: 'Rook — pilot', value: 'pilots:p1' }])
  })

  test('autocomplete works outside a channel', async () => {
    connect(OK_MINE)
    const { interaction, responses } = fakeAutocomplete({ subcommand: 'sheet' })
    await sheetCommand.autocomplete(interaction)
    expect(responses[0]).toHaveLength(3)
  })

  test('autocomplete stays empty when the call is denied', async () => {
    connect({ kind: 'denied', reason: 'unlinked', message: 'no' })
    const { interaction, responses } = fakeAutocomplete({ subcommand: 'sheet' })
    await sheetCommand.autocomplete(interaction)
    // An autocomplete has no way to explain itself; "no options" is the honest
    // rendering of every failure.
    expect(responses[0]).toEqual([])
  })
})

describe('parseSheetTarget', () => {
  test.each([
    ['pilots:p1', { table: 'pilots', entityId: 'p1' }],
    [
      'https://salvageunion.io/build/sheet/pilot/jd7k2m9p',
      { table: 'pilots', entityId: 'jd7k2m9p' },
    ],
    ['salvageunion.io/build/p/crawler/app%201?x=1', { table: 'crawlers', entityId: 'app 1' }],
    [
      'https://salvageunion.io/build/p/pilot/rook-vance-0a1b2c3d4e5f',
      { table: 'pilots', entityId: 'rook-vance-0a1b2c3d4e5f' },
    ],
    ['<https://preview.example/build/sheet/mech/m1>', { table: 'mechs', entityId: 'm1' }],
  ])('reads %s', (raw, expected) => {
    expect(parseSheetTarget(raw)).toEqual(expected as ReturnType<typeof parseSheetTarget>)
  })

  test.each([['Rook'], ['/p/npc/app1'], ['/sheet/pilot/%E0%A4%A']])('rejects %s', (raw) => {
    expect(parseSheetTarget(raw)).toBeNull()
  })
})

describe('/su dispatch', () => {
  test.each([
    ['me', OK_ME],
    ['games', { kind: 'ok' as const, value: { ok: true, games: [] } }],
  ])('routes /su %s', async (subcommand, result) => {
    connect(result)
    const { interaction, edits, followUps } = fakeExecute({ subcommand })
    await suCommand.execute(interaction)
    expect(edits.length + followUps.length).toBeGreaterThan(0)
  })

  test('routes /su sheet', async () => {
    connect({
      kind: 'ok',
      value: {
        ok: true,
        table: 'pilots',
        id: 'p1',
        appId: 'app-p1',
        ownerName: null,
        body: { callsign: 'X' },
      },
    })
    const { interaction, followUps } = fakeExecute({
      subcommand: 'sheet',
      strings: { entity: 'pilots:p1' },
    })
    await suCommand.execute(interaction)
    expectContainer(followUps[0], { ephemeral: true })
  })

  test('routes sheet autocomplete', async () => {
    connect(OK_MINE)
    const { interaction, responses } = fakeAutocomplete({ subcommand: 'sheet', focused: '' })
    await suCommand.autocomplete(interaction)
    expect(responses[0]).toHaveLength(3)
  })
})
