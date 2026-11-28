/**
 * The Activity's launch, against the channel bindings (ADR-068 §6): which
 * Game opens where the Activity was launched, and the one-tap bind that makes
 * a Game open there. Where the channel sits (its category and server) is the
 * bot's to read, with its token (`BOT_RELAY_CHANNEL_PATH`); without the bot,
 * the channel alone is matched.
 */

import type { BotRelay, ChannelPlace } from 'game-domain/botWire'
import { BOT_RELAY_CHANNEL_PATH, relayUrl } from 'game-domain/botWire'
import { mayBindChannel } from 'game-domain/games/discord'
import { RoomRefusal } from '../../rooms/refusal'
import { bindChannel, launchBinding } from './channelBindings'
import type { SharedDb } from './db'
import { gamesOf } from './games'

const NOWHERE: ChannelPlace = { categoryId: null, guildId: null, name: null }

/** Where a channel sits, as the bot reads it; nowhere when it cannot say. */
async function channelPlace(bot: BotRelay | undefined, channelId: string): Promise<ChannelPlace> {
  if (bot === undefined || !/^\d{1,25}$/.test(channelId)) return NOWHERE
  try {
    const res = await bot.fetch(relayUrl(BOT_RELAY_CHANNEL_PATH), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ channelId }),
      signal: AbortSignal.timeout(5_000),
    })
    if (!res.ok) return NOWHERE
    const place = (await res.json()) as Partial<ChannelPlace>
    return {
      categoryId: typeof place.categoryId === 'string' ? place.categoryId : null,
      guildId: typeof place.guildId === 'string' ? place.guildId : null,
      name: typeof place.name === 'string' ? place.name : null,
    }
  } catch {
    return NOWHERE
  }
}

/** A Game as the launch names it. */
type LaunchGame = { gameId: string; gameName: string }

/**
 * What the Activity opens: the Game bound where it was launched, when the
 * caller is in it; else the caller's Games they may bind here with one tap.
 */
export async function launchAnswer(
  db: SharedDb,
  bot: BotRelay | undefined,
  discordId: string,
  channelId: string
): Promise<{ game: LaunchGame | null; bindable: LaunchGame[] }> {
  const place = await channelPlace(bot, channelId)
  const bound = await launchBinding(db, { channelId, ...place })
  const games = await gamesOf(db, discordId)
  const mine = bound === null ? undefined : games.find((g) => g.gameId === bound.gameId)
  if (mine !== undefined)
    return { game: { gameId: mine.gameId, gameName: mine.name }, bindable: [] }
  return {
    game: null,
    // A Game bound here already that the caller is not in is not theirs to take.
    bindable:
      bound === null
        ? games.filter(mayBindChannel).map((g) => ({ gameId: g.gameId, gameName: g.name }))
        : [],
  }
}

/**
 * Bind the launch channel, and its category, to a Game from inside the
 * Activity: its Mediator or Organiser, as `/su bind` asks. The Activity
 * cannot read Discord permissions, so a channel held by another Game is
 * taken only by one who may manage that Game's binding.
 */
export async function bindHere(
  db: SharedDb,
  bot: BotRelay | undefined,
  discordId: string,
  args: { channelId: string; gameId: string }
): Promise<LaunchGame> {
  const place = await channelPlace(bot, args.channelId)
  const result = await bindChannel(db, discordId, {
    channelId: args.channelId,
    gameId: args.gameId,
    channelName: place.name,
    categoryId: place.categoryId,
    guildId: place.guildId,
  })
  if (!result.ok) throw new RoomRefusal(result.message ?? 'That channel could not be bound.')
  return { gameId: args.gameId, gameName: result.binding.gameName ?? '' }
}
