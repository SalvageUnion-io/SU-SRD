import { describe, expect, test } from 'bun:test'
import type { SiteGateway } from '../play/client'
import { createSiteClient, interpret } from '../play/client'

/**
 * The bot's app client, over the site Worker's `BotGateway`.
 *
 * Two things are worth pinning here: that an unbound client degrades to
 * `unavailable`, and that every gateway answer maps onto exactly one of the
 * three result kinds — because the commands branch exhaustively on those, and
 * an unmapped answer would show a player a permissions error for what was
 * actually an outage.
 */

describe('an unbound client', () => {
  test('answers unavailable, naming the missing configuration', async () => {
    const client = createSiteClient(undefined)
    const result = await client.me('d1')
    expect(result).toMatchObject({ kind: 'unavailable' })
    expect((result as { message: string }).message).toContain('not configured')
    expect((await client.sheet('d1', 'pilots', 'p1')).kind).toBe('unavailable')
  })
})

describe('interpret', () => {
  test('an ok payload becomes a value', () => {
    expect(interpret({ ok: true, games: [] })).toEqual({
      kind: 'ok',
      value: { ok: true, games: [] },
    })
  })

  test('a denial keeps its reason so the command can word it properly', () => {
    expect(interpret({ ok: false, reason: 'unlinked', message: 'nope' })).toEqual({
      kind: 'denied',
      reason: 'unlinked',
      message: 'nope',
    })
    // `/su bind`'s refusal is a denial too, never an outage.
    expect(interpret({ ok: false, reason: 'forbidden', message: 'not yours' })).toEqual({
      kind: 'denied',
      reason: 'forbidden',
      message: 'not yours',
    })
  })

  test('an unrecognised body is unavailable rather than silently ok', () => {
    // Failing closed matters: treating an unknown shape as success would render
    // a card full of "—" and look like real, empty data.
    expect(interpret(null).kind).toBe('unavailable')
    expect(interpret({ ok: false }).kind).toBe('unavailable')
    expect(interpret({ ok: false, reason: 'invented-reason' }).kind).toBe('unavailable')
    expect(interpret('gateway error').kind).toBe('unavailable')
  })
})

/** A gateway that records each op and its arguments, answering `answer`. */
function gateway(answer: () => Promise<unknown> = async () => ({ ok: true })) {
  const asked: { op: string; args: Record<string, unknown> }[] = []
  const site: SiteGateway = {
    answer: (op, args) => {
      asked.push({ op, args })
      return answer()
    },
  }
  return { asked, site }
}

type Client = ReturnType<typeof createSiteClient>

describe('the gateway', () => {
  test.each([
    ['me', (c: Client) => c.me('d1'), { discordId: 'd1' }],
    ['games', (c: Client) => c.games('d1'), { discordId: 'd1' }],
    ['mine', (c: Client) => c.mineForAutocomplete('d1'), { discordId: 'd1' }],
    [
      'sheet',
      (c: Client) => c.sheet('d1', 'pilots', 'p1'),
      { discordId: 'd1', table: 'pilots', entityId: 'p1' },
    ],
    ['games', (c: Client) => c.gamesForAutocomplete('d1'), { discordId: 'd1' }],
    [
      'bindChannel',
      (c: Client) => c.bindChannel('d1', 'ch1', 'g1'),
      { discordId: 'd1', channelId: 'ch1', game: 'g1' },
    ],
    [
      'bindChannel',
      (c: Client) => c.bindChannel('d1', 'ch1', 'g1', 'salvage-run'),
      { discordId: 'd1', channelId: 'ch1', channelName: 'salvage-run', game: 'g1' },
    ],
    [
      'bindChannel',
      // Solo play: no `game` key at all.
      (c: Client) => c.bindChannel('d1', 'ch1', null),
      { discordId: 'd1', channelId: 'ch1' },
    ],
    [
      'bindChannel',
      // In a server: whether the caller holds Manage Channels there.
      (c: Client) => c.bindChannel('d1', 'ch1', null, null, false),
      { discordId: 'd1', channelId: 'ch1', manageChannels: false },
    ],
    [
      'unbindChannel',
      (c: Client) => c.unbindChannel('d1', 'ch1'),
      { discordId: 'd1', channelId: 'ch1' },
    ],
    [
      'unbindChannel',
      (c: Client) => c.unbindChannel('d1', 'ch1', true),
      { discordId: 'd1', channelId: 'ch1', manageChannels: true },
    ],
  ])('%s sends the arguments the site reads', async (op, call, expected) => {
    // The one untyped seam: the gateway reads these by name, so a renamed
    // field would fail at run time rather than at build.
    const { asked, site } = gateway()
    await call(createSiteClient(site))
    expect(asked).toEqual([{ op, args: expected }])
  })

  test('takes the gateway’s answer', async () => {
    const { site } = gateway(async () => ({ ok: false, reason: 'unlinked', message: 'nope' }))
    expect(await createSiteClient(site).games('d1')).toEqual({
      kind: 'denied',
      reason: 'unlinked',
      message: 'nope',
    })
  })

  test('a null answer or a throw is an outage, not a crash', async () => {
    const declines = gateway(async () => null)
    expect((await createSiteClient(declines.site).games('d1')).kind).toBe('unavailable')
    const fails = gateway(async () => {
      throw new Error('su-srd is deploying')
    })
    const result = await createSiteClient(fails.site).games('d1')
    expect(result).toMatchObject({ kind: 'unavailable' })
    expect((result as { message: string }).message).toContain('could not be reached')
  })

  test('autocomplete gives up before Discord’s deadline', async () => {
    const slow = gateway(() => new Promise(() => {}))
    const started = Date.now()
    const result = await createSiteClient(slow.site).mineForAutocomplete('d1')
    expect(result.kind).toBe('unavailable')
    expect(Date.now() - started).toBeLessThan(2_900)
  })
})
