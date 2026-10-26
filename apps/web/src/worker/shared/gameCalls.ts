/**
 * The Games' calls a page makes outside a room's socket (ADR-064 §5): its
 * list of Games, starting, joining and ending one, its roster and invite, who
 * holds what, where a unit is, a move between rooms, and Discord's channels.
 * Each keeps the Convex function's name, arguments and answer, so a client
 * caller swaps `useQuery` for `useRoomQuery` and nothing else
 * (`../../replica/roomCalls.ts`).
 *
 * `POST /__rooms/call` `{name, args}` answers `{ok: true, value}` or
 * `{ok: false, refusal}` for a refusal worded for the player; a defect is a
 * 500 without its message. The session cookie names the player, by Discord
 * id, as the rooms do; signed out, only an invite's preview and the template
 * list answer.
 *
 * A Game room decides every rule; this file finds the rooms a call needs
 * (the shared database's `gamesOf` and `gameOfInvite`) and asks them. After
 * a call that changes a Game's roster or invite it has the room write its
 * shared rows again before answering, so the next list reads them.
 */

import { BOT_RELAY_POST_ROLL_PATH, isPostableRoll } from 'game-domain/botWire'
import type { EntityKind } from 'game-domain/entityKinds'
import type { PostRollResult } from 'game-domain/games/discord'
import { mayBindChannel } from 'game-domain/games/discord'
import type { GameActAnswer, GameActArgs, GameActName, GameActResult } from '../../rooms/game/acts'
import type { GameRead } from '../../rooms/game/roster'
import { templateList } from '../../rooms/game/template'
import type { HomeAddress, UnitHome } from '../../rooms/handoff'
import { handOff } from '../../rooms/handoff'
import { RoomRefusal } from '../../rooms/refusal'
import type { GameRoomStub } from '../rooms'
import type { SharedDb } from './db'
import { gameOfInvite, gamesOf } from './games'

/** A player's account room, as these calls use it. */
type AccountStub = UnitHome & {
  unit(actor: string, unitId: string): Promise<{ id: string; kind: EntityKind } | null>
}

/** Everything a call reaches: the shared database, the rooms, the bot, a fresh id. */
export type CallDeps = {
  db: SharedDb
  game(gameId: string): GameRoomStub
  account(discordId: string): AccountStub
  bot: BotRelayEnv
  newId(): string
  fetch: typeof fetch
}

/** The bot relay's address and secret (`wrangler.jsonc`); unset, a roll is not posted. */
export type BotRelayEnv = { BOT_URL?: string; BOT_SECRET?: string }

type Caller = { discordId: string; accountId: string }
type Call = (who: Caller, args: never, deps: CallDeps) => Promise<unknown>

/** An act's value, or its refusal thrown for the answer. */
async function act<N extends GameActName>(
  room: GameRoomStub,
  actor: string,
  name: N,
  args: GameActArgs<N>
): Promise<GameActResult<N>> {
  const answer: GameActAnswer<GameActResult<N>> = await room.act(actor, name, args)
  if (!answer.ok) throw new RoomRefusal(answer.refusal)
  return answer.value
}

/** A Game as `games.listMine` and `games.get` answered it. */
function gameView(read: GameRead) {
  const { gameId, templateOrigin, primaryCrawlerId: _primary, ...rest } = read
  return { _id: gameId, ...(templateOrigin === null ? {} : { templateOrigin }), ...rest }
}

/** What a roster shows of the player, from their account as the sign-in keeps it. */
async function profileOf(db: SharedDb, who: Caller) {
  const row = await db
    .prepare('select display_name, name, avatar_url from accounts where account_id = ?1')
    .bind(who.accountId)
    .first<{ display_name: string | null; name: string | null; avatar_url: string | null }>()
  return { displayName: row?.display_name ?? row?.name ?? null, avatarUrl: row?.avatar_url ?? null }
}

/** A code as every door that takes one reads it. */
const normalized = (code: string) => code.trim().toUpperCase()

/** Have the room write its shared rows now, so the next list reads the change. */
async function republished<T>(room: GameRoomStub, value: T): Promise<T> {
  await room.republish()
  return value
}

type BindingView = { channelId: string; channelName: string | null; boundAt: number }

async function bindingWhere(
  db: SharedDb,
  where: string,
  value: string
): Promise<BindingView | null> {
  const row = await db
    .prepare(`select channel_id, channel_name, bound_at from channel_bindings where ${where}`)
    .bind(value)
    .first<{ channel_id: string; channel_name: string | null; bound_at: number }>()
  return row === null
    ? null
    : { channelId: row.channel_id, channelName: row.channel_name, boundAt: row.bound_at }
}

const gameBinding = (db: SharedDb, gameId: string) => bindingWhere(db, 'game_id = ?1', gameId)
const soloBinding = (db: SharedDb, discordId: string) =>
  bindingWhere(db, 'game_id is null and bound_by = ?1', discordId)

/** Where a unit the player may see lives, and whether they may write it; null when nowhere. */
async function find(who: Caller, kind: EntityKind, id: string, deps: CallDeps) {
  const shelved = await deps.account(who.discordId).unit(who.discordId, id)
  if (shelved !== null && shelved.kind === kind) {
    return { home: { kind: 'account', userId: who.discordId } as HomeAddress, mayEdit: true }
  }
  for (const { gameId } of await gamesOf(deps.db, who.discordId)) {
    const room = deps.game(gameId)
    const unit = (await act(room, who.discordId, 'units', undefined as never)).find(
      (u) => u.id === id && u.kind === kind
    )
    if (unit === undefined) continue
    const runsTable = (await act(room, who.discordId, 'read', undefined as never))?.tableRunner
    const mayEdit = unit.ownerId === who.discordId || (kind === 'crawler' && runsTable === true)
    return { home: { kind: 'game', gameId } as HomeAddress, mayEdit }
  }
  return null
}

const homeOf = (address: HomeAddress, deps: CallDeps): UnitHome =>
  address.kind === 'game'
    ? (deps.game(address.gameId) as unknown as UnitHome)
    : deps.account(address.userId)

/** Who a roll card says rolled: the pilot, when the player may see it there, else the player. */
async function rollerName(
  who: Caller,
  gameId: string | null,
  pilotId: string | undefined,
  deps: CallDeps
) {
  if (pilotId !== undefined && gameId !== null) {
    const unit = await act(deps.game(gameId), who.discordId, 'unit', { unitId: pilotId })
    const body = unit?.kind === 'pilot' ? unit.body : null
    for (const field of ['callsign', 'name']) {
      const value = body?.[field]
      if (typeof value === 'string' && value.trim().length > 0) return value.trim()
    }
  }
  return (await profileOf(deps.db, who)).displayName ?? 'Crewmate'
}

const CALLS = {
  'games.listMine': async (who: Caller, _: object, deps: CallDeps) => {
    const games = await gamesOf(deps.db, who.discordId)
    const reads = await Promise.all(
      games.map(({ gameId }) => act(deps.game(gameId), who.discordId, 'read', undefined as never))
    )
    return reads.flatMap((read) => (read === null ? [] : [gameView(read)]))
  },
  'games.get': async (who: Caller, a: { gameId: string }, deps: CallDeps) => {
    const read = await act(deps.game(a.gameId), who.discordId, 'read', undefined as never)
    return read === null ? null : gameView(read)
  },
  'games.create': async (
    who: Caller,
    a: { name: string; templateOrigin?: string },
    deps: CallDeps
  ) => {
    const gameId = deps.newId()
    const room = deps.game(gameId)
    await act(room, who.discordId, 'create', { ...a, profile: await profileOf(deps.db, who) })
    return republished(room, gameId)
  },
  'games.destroy': async (who: Caller, a: { gameId: string }, deps: CallDeps) => {
    const room = deps.game(a.gameId)
    const answer = await room.disband(who.discordId)
    if (!answer.ok) throw new RoomRefusal(answer.refusal)
    return republished(room, null)
  },
  'games.setMediator': async (
    who: Caller,
    a: { gameId: string; userId: string; mediator: boolean },
    deps: CallDeps
  ) => {
    const room = deps.game(a.gameId)
    await act(room, who.discordId, 'setMediator', { userId: a.userId, mediator: a.mediator })
    return republished(room, null)
  },
  'games.setPrimaryCrawler': async (
    who: Caller,
    a: { gameId: string; crawlerId: string },
    deps: CallDeps
  ) => {
    await act(deps.game(a.gameId), who.discordId, 'setPrimaryCrawler', { crawlerId: a.crawlerId })
    return null
  },
  'games.members': async (who: Caller, a: { gameId: string }, deps: CallDeps) => {
    const members = await act(deps.game(a.gameId), who.discordId, 'members', undefined as never)
    return members.map((m) => ({
      userId: m.userId,
      displayName: m.displayName ?? 'Crewmate',
      ...(m.avatarUrl === null ? {} : { avatarUrl: m.avatarUrl }),
      mediator: m.mediator,
      organizer: m.organizer,
      joinedAt: m.joinedAt,
    }))
  },

  'invites.preview': async (who: Caller | null, a: { code: string }, deps: CallDeps) => {
    const gameId = await gameOfInvite(deps.db, normalized(a.code))
    if (gameId === null) return null
    return act(deps.game(gameId), who?.discordId ?? '', 'invitePreview', { code: a.code })
  },
  'invites.link': async (who: Caller, a: { gameId: string }, deps: CallDeps) => {
    const room = deps.game(a.gameId)
    return republished(room, await act(room, who.discordId, 'inviteCode', undefined as never))
  },
  'invites.reset': async (who: Caller, a: { gameId: string }, deps: CallDeps) => {
    const room = deps.game(a.gameId)
    const { code } = await act(room, who.discordId, 'resetInvite', undefined as never)
    return republished(room, code)
  },
  'invites.redeem': async (who: Caller, a: { code: string }, deps: CallDeps) => {
    const gameId = await gameOfInvite(deps.db, normalized(a.code))
    if (gameId === null) throw new RoomRefusal('That invite link is not valid')
    const room = deps.game(gameId)
    const profile = await profileOf(deps.db, who)
    const kind = await act(room, who.discordId, 'redeem', { code: a.code, profile })
    return republished(room, { kind, gameId })
  },

  'templates.list': async () => templateList(),
  'templates.createGame': async (
    who: Caller,
    a: { templateId: string; name?: string },
    deps: CallDeps
  ) => {
    const gameId = deps.newId()
    const room = deps.game(gameId)
    const profile = await profileOf(deps.db, who)
    await act(room, who.discordId, 'createFromTemplate', { ...a, profile })
    return republished(room, gameId)
  },

  'ownership.assign': async (
    who: Caller,
    a: { gameId: string; entityId: string; userId?: string },
    deps: CallDeps
  ) => {
    const args = { unitId: a.entityId, ...(a.userId === undefined ? {} : { userId: a.userId }) }
    await act(deps.game(a.gameId), who.discordId, 'assign', args)
    return null
  },
  'ownership.unassign': async (
    who: Caller,
    a: { gameId: string; entityId: string },
    deps: CallDeps
  ) => {
    await act(deps.game(a.gameId), who.discordId, 'unassign', { unitId: a.entityId })
    return null
  },

  'entities.listForGame': async (who: Caller, a: { gameId: string }, deps: CallDeps) => {
    const room = deps.game(a.gameId)
    const read = await act(room, who.discordId, 'read', undefined as never)
    const lists = { pilots: [], mechs: [], crawlers: [], npcs: [] } as Record<string, object[]>
    if (read === null) return { ...lists, softLinks: [], primaryCrawlerId: null }
    const [units, links] = await Promise.all([
      act(room, who.discordId, 'units', undefined as never),
      act(room, who.discordId, 'links', undefined as never),
    ])
    for (const u of units) {
      const row = { _id: u.id, appId: u.id, body: u.body }
      lists[`${u.kind}s`]?.push(u.kind === 'crawler' ? row : { ...row, ownerId: u.ownerId })
    }
    const softLinks = links.map((link) => ({
      _id: `${link.type}:${link.from.id}:${link.to.id}`,
      _creationTime: 0,
      gameId: a.gameId,
      ...link,
    }))
    return { ...lists, softLinks, primaryCrawlerId: read.primaryCrawlerId }
  },
  'entities.locate': async (who: Caller, a: { kind: EntityKind; id: string }, deps: CallDeps) => {
    const found = await find(who, a.kind, a.id, deps)
    if (found === null) return null
    return {
      id: a.id,
      gameId: found.home.kind === 'game' ? found.home.gameId : null,
      mayEdit: found.mayEdit,
    }
  },
  /** A unit to another Game or the player's Training Bay (`gameId` null), as one handoff. */
  'entities.move': async (
    who: Caller,
    a: { kind: EntityKind; appId: string; gameId: string | null },
    deps: CallDeps
  ) => {
    const found = await find(who, a.kind, a.appId, deps)
    if (found === null) throw new RoomRefusal('That build could not be found')
    const to: HomeAddress =
      a.gameId === null
        ? { kind: 'account', userId: who.discordId }
        : { kind: 'game', gameId: a.gameId }
    const from = found.home
    if (
      from.kind === to.kind &&
      (from.kind === 'game' ? from.gameId === (to as typeof from).gameId : true)
    ) {
      return null
    }
    const args = {
      leaseId: deps.newId(),
      unitId: a.appId,
      actor: who.discordId,
      to,
      at: Date.now(),
    }
    try {
      await handOff(homeOf(from, deps), homeOf(to, deps), args)
    } catch (error) {
      // A room's refusal loses its class over RPC; its words are the player's.
      if (error instanceof Error && error.name === 'RoomRefusal')
        throw new RoomRefusal(error.message)
      throw error
    }
    return null
  },

  'channelBindings.mine': async (who: Caller, _: object, deps: CallDeps) => {
    const games = []
    for (const game of await gamesOf(deps.db, who.discordId)) {
      games.push({
        gameId: game.gameId,
        gameName: game.name,
        mayBind: mayBindChannel(game),
        binding: await gameBinding(deps.db, game.gameId),
      })
    }
    return { personal: await soloBinding(deps.db, who.discordId), games }
  },
  'channelBindings.current': async (who: Caller, a: { gameId?: string }, deps: CallDeps) => {
    if (a.gameId === undefined) return soloBinding(deps.db, who.discordId)
    const read = await act(deps.game(a.gameId), who.discordId, 'read', undefined as never)
    return read === null ? null : gameBinding(deps.db, a.gameId)
  },
  'channelBindings.postRoll': async (
    who: Caller,
    a: {
      gameId?: string
      pilotId?: string
      roll: { tableName: string; rolls: number[] }
      post: boolean
    },
    deps: CallDeps
  ): Promise<PostRollResult> => {
    if (!a.post) return { kind: 'skipped' }
    const gameId = a.gameId ?? null
    if (gameId !== null) {
      const read = await act(deps.game(gameId), who.discordId, 'read', undefined as never)
      if (read === null) throw new RoomRefusal('Not a member of this Game')
    }
    const binding =
      gameId === null
        ? await soloBinding(deps.db, who.discordId)
        : await gameBinding(deps.db, gameId)
    if (binding === null) return { kind: 'unbound' }
    const { channelId } = binding
    const { tableName, rolls } = a.roll
    if (!isPostableRoll(tableName, rolls)) {
      return { kind: 'failed', channelId, message: 'That roll cannot be posted.' }
    }
    const botUrl = deps.bot.BOT_URL?.replace(/\/+$/, '')
    if (!botUrl || !deps.bot.BOT_SECRET) {
      return { kind: 'failed', channelId, message: 'Posting to Discord is not set up.' }
    }
    const roller = await rollerName(who, gameId, a.pilotId, deps)
    const isDiscord = !who.discordId.startsWith('test:')
    const request = {
      channelId,
      tableName,
      rolls,
      roller,
      ...(isDiscord ? { ownerDiscordId: who.discordId } : {}),
    }
    try {
      const response = await deps.fetch(`${botUrl}${BOT_RELAY_POST_ROLL_PATH}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${deps.bot.BOT_SECRET}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
        signal: AbortSignal.timeout(10_000),
      })
      const answer = (await response.json().catch(() => null)) as
        | { ok: true; messageId: string }
        | { ok: false; message: string }
        | null
      if (answer?.ok === true) return { kind: 'posted', channelId, messageId: answer.messageId }
      const message = answer?.ok === false ? answer.message : 'The bot did not answer.'
      console.warn(`[gameCalls] postRoll to ${channelId} failed (${response.status}): ${message}`)
      return { kind: 'failed', channelId, message }
    } catch (error) {
      console.warn(
        `[gameCalls] postRoll to ${channelId} failed: the bot could not be reached`,
        error
      )
      return { kind: 'failed', channelId, message: 'The bot could not be reached.' }
    }
  },
} satisfies Record<
  string,
  Call | ((who: Caller | null, args: never, deps: CallDeps) => Promise<unknown>)
>

type GameCallName = keyof typeof CALLS

/** The calls a signed-out visitor may make: an invite's preview, the template list. */
const SIGNED_OUT: ReadonlySet<string> = new Set(['invites.preview', 'templates.list'])

/** One call, by name, for `who`; a `RoomRefusal` comes back as an answer. */
export async function gameCall(
  name: string,
  args: unknown,
  who: Caller | null,
  deps: CallDeps
): Promise<{ ok: true; value: unknown } | { ok: false; refusal: string } | null> {
  if (!Object.hasOwn(CALLS, name)) return null
  if (who === null && !SIGNED_OUT.has(name)) return { ok: false, refusal: 'Sign in first' }
  const call = CALLS[name as GameCallName] as (
    who: Caller | null,
    args: unknown,
    deps: CallDeps
  ) => Promise<unknown>
  try {
    return { ok: true, value: await call(who, args ?? {}, deps) }
  } catch (error) {
    if (error instanceof RoomRefusal) return { ok: false, refusal: error.message }
    throw error
  }
}
