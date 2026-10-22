import { afterEach, describe, expect, test } from 'bun:test'
import { MessageFlags } from 'discord-api-types/v10'
import { boundContainer, unboundContainer } from '../bindingContainer'
import { bindCommand, unbindCommand } from '../commands/bind'
import { setSiteClient } from '../commands/siteReply'
import { suCommand } from '../commands/su'
import type { SiteClient } from '../play/client'
import type { BindChannelResult, GamesResult, SiteResult } from '../play/types'
import { cardText } from './cardText'
import { fakeAutocomplete, fakeExecute } from './fakeInteraction'

/**
 * `/su bind` and `/su unbind`. Who may bind what is the server's call
 * (`convex/model/channelBindings.ts`, proven in `channelBindings.test.ts`);
 * these pin what the bot sends it and how it words each answer: the channel it
 * ran in, the Game or none for solo play, and every refusal private.
 */

let restore: (() => void) | null = null
afterEach(() => {
  restore?.()
  restore = null
})

const unexpected = () => Promise.reject(new Error('not called in this test')) as never

/** A client that fails loudly on anything a test did not mean to call. */
function client(overrides: Partial<SiteClient>): SiteClient {
  return {
    me: unexpected,
    games: unexpected,
    mineForAutocomplete: unexpected,
    sheet: unexpected,
    gamesForAutocomplete: unexpected,
    bindChannel: unexpected,
    unbindChannel: unexpected,
    ...overrides,
  }
}

const BOUND_GAME: SiteResult<BindChannelResult> = {
  kind: 'ok',
  value: {
    binding: {
      channelId: 'channel-1',
      channelName: 'salvage-run',
      gameId: 'game-1',
      gameName: 'Tenacity',
    },
    previousChannelId: null,
  },
}

const BOUND_SOLO: SiteResult<BindChannelResult> = {
  kind: 'ok',
  value: {
    binding: { channelId: 'channel-1', channelName: null, gameId: null, gameName: null },
    previousChannelId: 'channel-0',
  },
}

describe('/su bind', () => {
  test('binds the channel it ran in to the picked Game, privately', async () => {
    let asked: unknown[] = []
    restore = setSiteClient(
      client({
        bindChannel: (...args) => {
          asked = args
          return Promise.resolve(BOUND_GAME)
        },
      })
    )
    const { interaction, followUps, deferred } = fakeExecute({
      subcommand: 'bind',
      userId: 'discord-me',
      channelId: 'channel-1',
      channelName: 'salvage-run',
      strings: { game: 'game-1' },
    })
    await bindCommand.execute(interaction)
    // The channel's name rides beside its id, so Play can show `#salvage-run`.
    expect(asked).toEqual(['discord-me', 'channel-1', 'game-1', 'salvage-run'])
    expect(deferred).toEqual({ called: true, ephemeral: true })
    expect(followUps[0]?.flags).toBe(MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral)
  })

  test('with no Game, binds the channel to the caller’s solo play', async () => {
    let asked: unknown[] = []
    restore = setSiteClient(
      client({
        bindChannel: (...args) => {
          asked = args
          return Promise.resolve(BOUND_SOLO)
        },
      })
    )
    const { interaction, followUps } = fakeExecute({ subcommand: 'bind', userId: 'discord-me' })
    await bindCommand.execute(interaction)
    expect(asked).toEqual(['discord-me', 'channel-1', null, 'salvage-run'])
    expect(followUps).toHaveLength(1)
  })

  test('a blank Game option is solo too, never an empty id', async () => {
    let game: unknown = 'unset'
    restore = setSiteClient(
      client({
        bindChannel: (_d, _c, g) => {
          game = g
          return Promise.resolve(BOUND_SOLO)
        },
      })
    )
    const { interaction } = fakeExecute({ subcommand: 'bind', strings: { game: '   ' } })
    await bindCommand.execute(interaction)
    expect(game).toBeNull()
  })

  test('a player who does not run the Game is refused, privately, in the server’s words', async () => {
    const message = 'Only the Game’s Mediator or Organiser can bind a channel to it.'
    restore = setSiteClient(
      client({
        bindChannel: () => Promise.resolve({ kind: 'denied', reason: 'forbidden', message }),
      })
    )
    const { interaction, edits, followUps, deferred } = fakeExecute({
      subcommand: 'bind',
      strings: { game: 'game-1' },
    })
    await bindCommand.execute(interaction)
    expect(deferred.ephemeral).toBe(true)
    expect(followUps).toHaveLength(0)
    expect(edits[0]?.content).toBe(message)
  })

  test('somebody with no account is told how to get one', async () => {
    restore = setSiteClient(
      client({
        bindChannel: () =>
          Promise.resolve({ kind: 'denied', reason: 'unlinked', message: 'No account.' }),
      })
    )
    const { interaction, edits } = fakeExecute({ subcommand: 'bind' })
    await bindCommand.execute(interaction)
    expect(edits[0]?.content).toContain('account')
    expect(edits[0]?.content).toContain('/account')
  })

  test('an outage reads as an outage', async () => {
    restore = setSiteClient(
      client({
        bindChannel: () =>
          Promise.resolve({ kind: 'unavailable', message: 'The app could not be reached.' }),
      })
    )
    const { interaction, edits } = fakeExecute({ subcommand: 'bind' })
    await bindCommand.execute(interaction)
    expect(edits[0]?.content).toContain('could not be reached')
  })

  test('with no channel to bind it asks for one and calls nothing', async () => {
    restore = setSiteClient(client({}))
    const { interaction, replies } = fakeExecute({ subcommand: 'bind', channelId: null })
    await bindCommand.execute(interaction)
    expect(replies[0]?.flags).toBe(MessageFlags.Ephemeral)
    expect(replies[0]?.content).toContain('channel')
  })

  test('autocomplete offers only the Games the caller runs or organises', async () => {
    const games: SiteResult<GamesResult> = {
      kind: 'ok',
      value: {
        games: [
          { gameId: 'g-med', name: 'Tenacity', mediator: true, organizer: false },
          { gameId: 'g-org', name: 'Tin Can', mediator: false, organizer: true },
          { gameId: 'g-play', name: 'Tempest', mediator: false, organizer: false },
        ],
      },
    }
    restore = setSiteClient(client({ gamesForAutocomplete: () => Promise.resolve(games) }))
    const { interaction, responses } = fakeAutocomplete({ subcommand: 'bind', focused: 't' })
    await suCommand.autocomplete(interaction)
    expect(responses[0]).toEqual([
      { name: 'Tenacity', value: 'g-med' },
      { name: 'Tin Can', value: 'g-org' },
    ])
  })

  test('autocomplete is empty when the app cannot answer', async () => {
    restore = setSiteClient(
      client({
        gamesForAutocomplete: () => Promise.resolve({ kind: 'unavailable', message: 'down' }),
      })
    )
    const { interaction, responses } = fakeAutocomplete({ subcommand: 'bind' })
    await bindCommand.autocomplete(interaction)
    expect(responses[0]).toEqual([])
  })
})

describe('/su unbind', () => {
  test('releases the channel it ran in', async () => {
    let asked: unknown[] = []
    restore = setSiteClient(
      client({
        unbindChannel: (...args) => {
          asked = args
          return Promise.resolve({
            kind: 'ok',
            value: {
              unbound: {
                channelId: 'channel-9',
                channelName: 'salvage-run',
                gameId: 'game-1',
                gameName: 'Tenacity',
              },
            },
          })
        },
      })
    )
    const { interaction, followUps } = fakeExecute({
      subcommand: 'unbind',
      userId: 'discord-me',
      channelId: 'channel-9',
    })
    await suCommand.execute(interaction)
    expect(asked).toEqual(['discord-me', 'channel-9'])
    expect(followUps[0]?.flags).toBe(MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral)
  })

  test('somebody else’s binding is refused, privately', async () => {
    const message = 'Only the Game’s Mediator or Organiser can unbind its channel.'
    restore = setSiteClient(
      client({
        unbindChannel: () => Promise.resolve({ kind: 'denied', reason: 'forbidden', message }),
      })
    )
    const { interaction, edits, followUps } = fakeExecute({ subcommand: 'unbind' })
    await unbindCommand.execute(interaction)
    expect(followUps).toHaveLength(0)
    expect(edits[0]?.content).toBe(message)
  })
})

describe('the replies', () => {
  test('a Game binding names the Game and the channel', () => {
    const text = cardText(boundContainer(BOUND_GAME.kind === 'ok' ? BOUND_GAME.value : never()))
    expect(text).toContain('<#channel-1>')
    expect(text).toContain('Tenacity')
  })

  test('a moved solo binding names where it moved from', () => {
    const text = cardText(boundContainer(BOUND_SOLO.kind === 'ok' ? BOUND_SOLO.value : never()))
    expect(text).toContain('solo')
    expect(text).toContain('<#channel-0>')
  })

  test('unbinding a channel that was not bound says so', () => {
    expect(cardText(unboundContainer({ unbound: null }, 'channel-3'))).toContain('was not bound')
  })
})

function never(): never {
  throw new Error('unreachable')
}
