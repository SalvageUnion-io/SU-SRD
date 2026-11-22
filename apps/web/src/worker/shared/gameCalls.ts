/**
 * The Games' calls a page makes outside a room's socket (ADR-064 §5): its
 * list of Games, starting, joining and ending one, its roster and invite, who
 * holds what, where a unit is, a move between rooms, and Discord's channels.
 * Each keeps its name, arguments and answer, so a client
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

import type { BotRelay } from 'game-domain/botWire'
import {
  BOT_RELAY_POST_ROLL_PATH,
  isPostableRoll,
  ROLL_LABEL_MAX,
  relayUrl,
} from 'game-domain/botWire'
import type { EntityKind } from 'game-domain/entityKinds'
import { ENTITY_KINDS } from 'game-domain/entityKinds'
import type { PostRollResult } from 'game-domain/games/discord'
import { mayBindChannel } from 'game-domain/games/discord'
import { pilotLabelOf } from 'game-domain/pilotLabel'
import type { GamePlan } from 'game-domain/schemas/gamePlan'
import { GamePlanSchema } from 'game-domain/schemas/gamePlan'
import { z } from 'salvageunion-reference/zod'
import type { GameActAnswer, GameActArgs, GameActName, GameActResult } from '../../rooms/game/acts'
import type { GameRead, Profile } from '../../rooms/game/roster'
import { templateList } from '../../rooms/game/template'
import type { HomeAddress, UnitHome } from '../../rooms/handoff'
import { handOff } from '../../rooms/handoff'
import { RoomRefusal } from '../../rooms/refusal'
import type { GameRoomStub } from '../roomStubs'
import { shownProfile, signInProfile } from './accounts'
import { gameBindingView, rollChannel, soloBindingView } from './channelBindings'
import type { SharedDb } from './db'
import { gameOfInvite, gamesOf, memberAccountNames, membershipOf } from './games'

/** A player's account room, as these calls use it. */
type AccountStub = UnitHome & {
  unit(actor: string, unitId: string): Promise<{ id: string; kind: EntityKind } | null>
  profile(actor: string): Promise<Profile | null>
  joinedGame(gameId: string): Promise<void>
  leftGame(gameId: string): Promise<void>
}

/** Everything a call reaches: the shared database, the rooms, the bot, a fresh id. */
export type CallDeps = {
  db: SharedDb
  game(gameId: string): GameRoomStub
  account(discordId: string): AccountStub
  /** The bot's relay (`wrangler.jsonc` `BOT`); unbound, a roll is not posted. */
  bot: BotRelay | undefined
  newId(): string
}

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

/** What a roster shows of the player: their own name and avatar, else Discord's. */
async function profileOf(deps: CallDeps, who: Caller): Promise<Profile> {
  const [discord, own] = await Promise.all([
    signInProfile(deps.db, who.accountId),
    deps.account(who.discordId).profile(who.discordId),
  ])
  return shownProfile(own, discord)
}

/** A code as every door that takes one reads it. */
const normalized = (code: string) => code.trim().toUpperCase()

/**
 * Start Game `gameId` as the player: their account room notes it first, so
 * deleting the account finds it even if the Game's shared rows never land.
 * A refused start was never theirs, so the note goes again.
 */
async function started(who: Caller, gameId: string, deps: CallDeps, start: () => Promise<void>) {
  const account = deps.account(who.discordId)
  await account.joinedGame(gameId)
  try {
    await start()
  } catch (error) {
    if (error instanceof RoomRefusal) await account.leftGame(gameId)
    throw error
  }
  return republished(deps.game(gameId), gameId)
}

/**
 * A Game's creator is its Organiser, and its Mediator too where they said so
 * as they made it ("Will you be the Mediator?"): the Organiser's own appointment.
 */
async function mediatedByCreator(room: GameRoomStub, who: Caller, mediator: boolean | undefined) {
  if (mediator !== true) return
  await act(room, who.discordId, 'setMediator', { userId: who.discordId, mediator: true })
}

/** Have the room write its shared rows now, so the next list reads the change. */
async function republished<T>(room: GameRoomStub, value: T): Promise<T> {
  await room.republish()
  return value
}

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
    const named = unit?.kind === 'pilot' ? pilotLabelOf(unit.body) : null
    if (named !== null) return named
  }
  return (await profileOf(deps, who)).displayName ?? 'Crewmate'
}

const CALLS = {
  'games.listMine': async (who: Caller, _: object, deps: CallDeps) => {
    const games = await gamesOf(deps.db, who.discordId)
    const reads = await Promise.all(
      games.map(({ gameId }) => act(deps.game(gameId), who.discordId, 'read', undefined as never))
    )
    return reads.flatMap((read) => (read === null ? [] : [gameView(read)]))
  },
  /**
   * The caller's Games with a session running: a Reference page's session bar
   * holds no socket. Each says whose door it is (r3 H3): the caller mediates,
   * or the one pilot assigned to them there, whose seat the door opens.
   */
  'games.liveSessions': async (who: Caller, _: object, deps: CallDeps) => {
    const games = await gamesOf(deps.db, who.discordId)
    const live = games.map(async ({ gameId }) => {
      const room = deps.game(gameId)
      const session = await act(room, who.discordId, 'session.state', undefined as never)
      const read = session.live ? await act(room, who.discordId, 'read', undefined as never) : null
      if (read === null) return null
      const units = await act(room, who.discordId, 'units', undefined as never)
      const mine = units.filter((unit) => unit.kind === 'pilot' && unit.ownerId === who.discordId)
      const seat = mine.length === 1 ? mine[0] : undefined
      return {
        gameId,
        name: read.name,
        startedAt: session.startedAt,
        ...(read.mediator ? { mediator: true as const } : {}),
        ...(seat === undefined ? {} : { pilotId: seat.id }),
      }
    })
    return (await Promise.all(live)).filter((game) => game !== null)
  },
  'games.get': async (who: Caller, a: { gameId: string }, deps: CallDeps) => {
    const read = await act(deps.game(a.gameId), who.discordId, 'read', undefined as never)
    return read === null ? null : gameView(read)
  },
  /**
   * What each member is called, read from their account (their own profile
   * name, else Discord's) every time, so a roster never shows a stale or
   * missing name. Members only; a name nobody has is left out.
   */
  'games.names': async (who: Caller, a: { gameId: string }, deps: CallDeps) => {
    if ((await membershipOf(deps.db, a.gameId, who.discordId)) === null) return {}
    const accounts = await memberAccountNames(deps.db, a.gameId)
    const named = await Promise.all(
      accounts.map(async ({ discordId, name }) => {
        const own = await deps.account(discordId).profile(discordId)
        return [discordId, shownProfile(own, { name, avatar_url: null }).displayName] as const
      })
    )
    return Object.fromEntries(named.filter((entry): entry is [string, string] => entry[1] !== null))
  },
  'games.create': async (
    who: Caller,
    { mediator, ...a }: { name: string; templateOrigin?: string; mediator?: boolean | undefined },
    deps: CallDeps
  ) => {
    const gameId = deps.newId()
    const profile = await profileOf(deps, who)
    return started(who, gameId, deps, async () => {
      await act(deps.game(gameId), who.discordId, 'create', { ...a, profile })
      await mediatedByCreator(deps.game(gameId), who, mediator)
    })
  },
  /** End the Game; `dropTemplateUnits` takes a template's untouched units with it. */
  'games.destroy': async (
    who: Caller,
    a: { gameId: string; dropTemplateUnits?: boolean },
    deps: CallDeps
  ) => {
    const room = deps.game(a.gameId)
    const answer = await room.disband(
      who.discordId,
      a.dropTemplateUnits === true ? { dropTemplateUnits: true } : {}
    )
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
  /** The Game's name or description (ADR-067 §3), the Organiser's to change. */
  'games.update': async (
    who: Caller,
    a: { gameId: string; name?: string; description?: string },
    deps: CallDeps
  ) => {
    const room = deps.game(a.gameId)
    const { gameId: _gameId, ...patch } = a
    await act(room, who.discordId, 'updateSettings', patch)
    return republished(room, null)
  },
  /** Leave (`userId` absent) or, as the Organiser, remove a member; their units go home first. */
  'games.removeMember': async (
    who: Caller,
    a: { gameId: string; userId?: string },
    deps: CallDeps
  ) => {
    const room = deps.game(a.gameId)
    const answer = await room.dismiss(who.discordId, a.userId ?? who.discordId)
    if (!answer.ok) throw new RoomRefusal(answer.refusal)
    return republished(room, null)
  },
  /** The Game's plan (ADR-067 §4): its table runner's alone. */
  'plan.get': async (who: Caller, a: { gameId: string }, deps: CallDeps) =>
    act(deps.game(a.gameId), who.discordId, 'plan.get', undefined as never),
  'plan.set': async (who: Caller, a: { gameId: string; plan: GamePlan }, deps: CallDeps) => {
    await act(deps.game(a.gameId), who.discordId, 'plan.set', { plan: a.plan })
    return null
  },
  'games.setPrimaryCrawler': async (
    who: Caller,
    a: { gameId: string; crawlerId: string },
    deps: CallDeps
  ) => {
    await act(deps.game(a.gameId), who.discordId, 'setPrimaryCrawler', { crawlerId: a.crawlerId })
    return null
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
    const profile = await profileOf(deps, who)
    // Noted before the join, as a start is. A refused join leaves a note for a Game
    // they are not in, which deletion's forget passes over.
    await deps.account(who.discordId).joinedGame(gameId)
    const kind = await act(room, who.discordId, 'redeem', { code: a.code, profile })
    return republished(room, { kind, gameId })
  },

  'templates.list': async () => templateList(),
  'templates.createGame': async (
    who: Caller,
    { mediator, ...a }: { templateId: string; name?: string; mediator?: boolean | undefined },
    deps: CallDeps
  ) => {
    const gameId = deps.newId()
    const profile = await profileOf(deps, who)
    return started(who, gameId, deps, async () => {
      await act(deps.game(gameId), who.discordId, 'createFromTemplate', { ...a, profile })
      await mediatedByCreator(deps.game(gameId), who, mediator)
    })
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

  'entities.remove': async (
    who: Caller,
    a: { gameId: string; entityId: string },
    deps: CallDeps
  ) => {
    await act(deps.game(a.gameId), who.discordId, 'removeUnit', { unitId: a.entityId })
    return null
  },
  'entities.removeCrawler': async (
    who: Caller,
    a: { gameId: string; crawlerId: string },
    deps: CallDeps
  ) => {
    await act(deps.game(a.gameId), who.discordId, 'removeUnit', { unitId: a.crawlerId })
    return null
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
        binding: await gameBindingView(deps.db, game.gameId),
      })
    }
    return { personal: await soloBindingView(deps.db, who.discordId), games }
  },
  'channelBindings.current': async (who: Caller, a: { gameId?: string }, deps: CallDeps) => {
    if (a.gameId === undefined) return soloBindingView(deps.db, who.discordId)
    const read = await act(deps.game(a.gameId), who.discordId, 'read', undefined as never)
    return read === null ? null : rollChannel(deps.db, who.discordId, a.gameId)
  },
  'channelBindings.postRoll': async (
    who: Caller,
    a: {
      gameId?: string
      pilotId?: string
      roll: { tableName: string; rolls: number[]; label?: string | undefined }
    },
    deps: CallDeps
  ): Promise<PostRollResult> => {
    const gameId = a.gameId ?? null
    if (gameId !== null) {
      const read = await act(deps.game(gameId), who.discordId, 'read', undefined as never)
      if (read === null) throw new RoomRefusal('Not a member of this Game')
    }
    const binding = await rollChannel(deps.db, who.discordId, gameId)
    if (binding === null) return { kind: 'unbound' }
    const { channelId } = binding
    const { tableName, rolls, label } = a.roll
    if (!isPostableRoll(tableName, rolls)) {
      return { kind: 'failed', channelId, message: 'That roll cannot be posted.' }
    }
    const bot = deps.bot
    if (bot === undefined) {
      return { kind: 'failed', channelId, message: 'Posting to Discord is not set up.' }
    }
    const roller = await rollerName(who, gameId, a.pilotId, deps)
    const isDiscord = !who.discordId.startsWith('test:')
    const request = {
      channelId,
      tableName,
      rolls,
      roller,
      ...(label !== undefined && label !== tableName
        ? { label: label.slice(0, ROLL_LABEL_MAX) }
        : {}),
      ...(isDiscord ? { ownerDiscordId: who.discordId } : {}),
    }
    try {
      const response = await bot.fetch(relayUrl(BOT_RELAY_POST_ROLL_PATH), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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

/** Every call by name, as a client names it (`../../replica/roomCalls.ts`). */
export type GameCallName = keyof typeof CALLS

/** What a call takes, as its page sends it; none for a call that takes none. */
export type GameCallArgs<N extends GameCallName> =
  Parameters<(typeof CALLS)[N]> extends [unknown, infer A, ...unknown[]] ? A : Record<string, never>

/** What a call answers. */
export type GameCallResult<N extends GameCallName> = Awaited<ReturnType<(typeof CALLS)[N]>>

const GAME = z.object({ gameId: z.string() })
const KIND = z.enum(ENTITY_KINDS)

/**
 * What each call takes, parsed before it runs, as a socket act's args are
 * (`../../rooms/game/socketActs.ts`). What the args mean (a name not too
 * long, a unit that exists) is still the room's to refuse.
 */
const CALL_ARGS = {
  'games.listMine': z.object({}),
  'games.liveSessions': z.object({}),
  'games.get': GAME,
  'games.names': GAME,
  'games.create': z.object({
    name: z.string(),
    templateOrigin: z.string().optional(),
    mediator: z.boolean().optional(),
  }),
  'games.destroy': GAME.extend({ dropTemplateUnits: z.boolean().optional() }),
  'games.setMediator': GAME.extend({ userId: z.string(), mediator: z.boolean() }),
  'games.update': GAME.extend({ name: z.string().optional(), description: z.string().optional() }),
  'games.removeMember': GAME.extend({ userId: z.string().optional() }),
  'plan.get': GAME,
  'plan.set': GAME.extend({ plan: GamePlanSchema }),
  'games.setPrimaryCrawler': GAME.extend({ crawlerId: z.string() }),
  'invites.link': GAME,
  'invites.reset': GAME,
  'invites.redeem': z.object({ code: z.string() }),
  'templates.list': z.object({}),
  'templates.createGame': z.object({
    templateId: z.string(),
    name: z.string().optional(),
    mediator: z.boolean().optional(),
  }),
  'ownership.assign': GAME.extend({ entityId: z.string(), userId: z.string().optional() }),
  'ownership.unassign': GAME.extend({ entityId: z.string() }),
  'entities.remove': GAME.extend({ entityId: z.string() }),
  'entities.removeCrawler': GAME.extend({ crawlerId: z.string() }),
  'entities.locate': z.object({ kind: KIND, id: z.string() }),
  'entities.move': z.object({ kind: KIND, appId: z.string(), gameId: z.string().nullable() }),
  'channelBindings.mine': z.object({}),
  'channelBindings.current': z.object({ gameId: z.string().optional() }),
  'channelBindings.postRoll': z.object({
    gameId: z.string().optional(),
    pilotId: z.string().optional(),
    roll: z.object({
      tableName: z.string(),
      rolls: z.array(z.number()),
      label: z.string().optional(),
    }),
  }),
} satisfies Record<GameCallName, z.ZodType>

/** The call a signed-out visitor may make: the template list. An invite's preview is a Worker route. */
const SIGNED_OUT: ReadonlySet<string> = new Set(['templates.list'])

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
  const parsed = CALL_ARGS[name as GameCallName].safeParse(args ?? {})
  if (!parsed.success) return { ok: false, refusal: 'Not what that call takes' }
  try {
    return { ok: true, value: await call(who, parsed.data, deps) }
  } catch (error) {
    if (error instanceof RoomRefusal) return { ok: false, refusal: error.message }
    throw error
  }
}
