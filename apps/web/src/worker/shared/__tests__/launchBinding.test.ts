import { describe, expect, it } from 'bun:test'
import type { BotRelay } from 'game-domain/botWire'
import { BOT_RELAY_CHANNEL_PATH } from 'game-domain/botWire'
import { bindingForGame } from '../channelBindings'
import { bindHere, launchAnswer } from '../launchBinding'
import { publishGame, testDb } from './d1'

/** Rosa mediates Reclamation; Tam plays in it; Ines is in no Game. */
async function table() {
  const db = testDb()
  await publishGame(db, 'g-1', {
    name: 'Reclamation',
    mediatedBy: 'Rosa',
    members: [
      { discordId: 'rosa', mediator: true, organizer: false },
      { discordId: 'tam', mediator: false, organizer: false },
    ],
  })
  return db
}

/** The bot, saying every channel sits in the Eldridge Coast's category. */
function bot(asked: string[] = []): BotRelay {
  return {
    fetch: async (url, init) => {
      asked.push(new URL(url).pathname)
      const { channelId } = JSON.parse(String(init?.body)) as { channelId: string }
      return Response.json({
        categoryId: 'cat-eldridge',
        guildId: 'server',
        name: `ch-${channelId}`,
      })
    },
  }
}

describe('the Activity’s launch (ADR-068 §6)', () => {
  it('a Mediator in an unbound channel may run their Game here; a player may not', async () => {
    const db = await table()
    expect(await launchAnswer(db, bot(), 'rosa', '100')).toEqual({
      game: null,
      bindable: [{ gameId: 'g-1', gameName: 'Reclamation' }],
    })
    expect(await launchAnswer(db, bot(), 'tam', '100')).toEqual({ game: null, bindable: [] })
  })

  it('the one-tap bind binds the channel and its category, so the whole category opens it', async () => {
    const db = await table()
    const asked: string[] = []
    expect(await bindHere(db, bot(asked), 'rosa', { channelId: '100', gameId: 'g-1' })).toEqual({
      gameId: 'g-1',
      gameName: 'Reclamation',
    })
    expect(asked).toEqual([BOT_RELAY_CHANNEL_PATH])
    expect(await bindingForGame(db, 'g-1')).toMatchObject({
      channelId: '100',
      channelName: 'ch-100',
    })
    expect(await launchAnswer(db, bot(), 'tam', '200')).toEqual({
      game: { gameId: 'g-1', gameName: 'Reclamation' },
      bindable: [],
    })
    // Somebody not in the Game is offered nothing to take over.
    expect(await launchAnswer(db, bot(), 'ines', '200')).toEqual({ game: null, bindable: [] })
  })

  it('a player cannot bind; without the bot, the channel alone is matched', async () => {
    const db = await table()
    await expect(bindHere(db, bot(), 'tam', { channelId: '100', gameId: 'g-1' })).rejects.toThrow(
      'Mediator or Organiser'
    )
    await bindHere(db, undefined, 'rosa', { channelId: '100', gameId: 'g-1' })
    expect((await launchAnswer(db, undefined, 'tam', '100')).game?.gameId).toBe('g-1')
    expect((await launchAnswer(db, undefined, 'tam', '200')).game).toBeNull()
  })

  it('a bot that fails says nowhere, never an error', async () => {
    const db = await table()
    const broken: BotRelay = {
      fetch: async () => {
        throw new Error('down')
      },
    }
    expect(await launchAnswer(db, broken, 'rosa', '100')).toMatchObject({ game: null })
  })
})
