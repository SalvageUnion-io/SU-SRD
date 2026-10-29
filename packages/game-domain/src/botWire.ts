/**
 * The wire between the Discord bot and the site Worker (ADR-030): what the
 * site's `BotGateway` answers each op (`apps/web/src/worker/botGateway.ts`),
 * and what the site asks the bot's `Relay` to post.
 *
 * ONE declaration, two readers, so a change to an answer is a compile error
 * on both sides. It imports nothing but `entityKinds`: every file the bot
 * imports is type-checked under the bot's settings, and a leaf costs the bot
 * nothing at runtime.
 *
 * The types still describe a boundary, so the bot keeps reading them
 * defensively: bot and site ship separately, and a bot can meet a site older
 * than its own types.
 */

import type { SheetTable } from './entityKinds'

/**
 * Every operation the bot may ask the site. The writes never touch
 * anybody's sheet: `bindChannel` and `unbindChannel` (`/su bind`, `/su
 * unbind`) are the bot's own apparatus, `usage` bumps a weekly command tally
 * and `feedback` hands on a `/su feedback` note (ADR-057).
 */
const BOT_OP_NAMES = [
  'me',
  'games',
  'sheet',
  'mine',
  'bindChannel',
  'unbindChannel',
  'usage',
  'feedback',
] as const

/** One of {@link BOT_OP_NAMES}. */
export type BotOpName = (typeof BOT_OP_NAMES)[number]

/**
 * Why the bot could not act, when it could not: no app account carries this
 * Discord id (`unlinked`), the sheet or Game asked for is absent or not the
 * caller's to read (`not-found`, one answer for both so neither discloses), or
 * the caller is known but may not do this (`forbidden`: binding a channel to a
 * Game they do not run, or taking over a channel somebody else bound).
 *
 * The bot renders each into an **ephemeral** reply, visible only to the person
 * who asked, so a public channel never learns who holds an account. Returned
 * rather than thrown because neither is exceptional.
 */
export type BotDenialReason = 'unlinked' | 'not-found' | 'forbidden'

/** A refusal, as `botClient` sends it. */
export type BotFailure = { ok: false; reason: BotDenialReason; message: string }

/** A success: the payload's own fields beside `ok: true`. */
export type BotSuccess<T> = { ok: true } & T

/** A Game the caller belongs to. */
export type GameSummary = {
  gameId: string
  name: string
  mediator: boolean
  organizer: boolean
}

export type MeResult = {
  user: { userId: string; displayName: string; avatarUrl: string | null }
  games: GameSummary[]
}

export type GamesResult = { games: GameSummary[] }

/**
 * An entity body, exactly as the room stores it — opaque to the bot, which
 * must not pretend otherwise. Everything read off a body is read defensively, and the
 * derived maxima come from the server's `SheetResult.vitals` rather than from
 * any field claimed to be here.
 */
export type EntityBody = Record<string, unknown>

/** One of the caller's own entities: no owner to name, because the owner is the caller. */
type ShelfEntity = { id: string; body: EntityBody }

/**
 * What `/su sheet` offers as you type: every pilot, mech and crawler you own,
 * in a Game or not, and the communal crawler of each Game you belong to.
 */
export type MineResult = {
  pilots: ShelfEntity[]
  mechs: ShelfEntity[]
  crawlers: ShelfEntity[]
}

export type SheetResult = {
  table: SheetTable
  id: string
  /** The app-level id, which addresses the public link (`/p/<kind>/<appId>`). */
  appId: string | null
  /**
   * Whether this sheet has a public, account-free URL (ADR-032).
   *
   * Opt-in per entity and off by default, so this is `false` for almost every
   * sheet. The bot renders a `/p/<kind>/<appId>` link **only** when it is true:
   * a private sheet has no public URL, and offering one would hand the reader a
   * 404.
   *
   * `botClient` always sends it. It is optional in the TYPE because the bot can
   * meet a deployment running an older `botClient` that sends no such key — and
   * absent must read as private, never as published, which is what makes the
   * falsy default the safe one.
   */
  publicRead?: boolean
  ownerName: string | null
  body: EntityBody
  /**
   * The server's derived maxima and status for a pilot or a mech: the same
   * derivation `crew.vitals` serves Play's Crew (ADR-038 §4), so
   * the bot and every client show one answer. Null for a crawler, which is
   * not crew.
   *
   * Optional in the TYPE for the same reason as `publicRead`: a bot can meet a
   * site older than this field (a rolled-back site still answers). Absent
   * reads as "maxima unknown", and the bot shows the current values alone.
   */
  vitals?: SheetVitals | null
}

/** A pilot's derived status (`PilotStatus` in `game-domain/rules/crewStatus`). */
type PilotCrewStatus = { dead: boolean; injured: boolean; ejected: boolean }

/** A mech's derived status (`MechStatus` in `game-domain/rules/crewStatus`). */
type MechCrewStatus = {
  destroyed: boolean
  shutdown: boolean
  overheating: boolean
  destroyedSystems: string[]
  destroyedModules: string[]
}

/**
 * A pilot's derived numbers, or nulls when the body is not a readable pilot.
 * `crew.vitals` returns exactly these fields on each pilot row; its validator
 * mirrors this type, so the two cannot drift.
 */
export type PilotDerived = {
  maxHP: number | null
  maxAP: number | null
  status: PilotCrewStatus
  /** Whether the Crew tab flags this pilot: dead, injured or ejected. */
  attention: boolean
}

/** A mech's derived numbers, or nulls when the body is not a readable mech. */
export type MechDerived = {
  maxSP: number | null
  maxEP: number | null
  maxHeat: number | null
  status: MechCrewStatus | null
  /** Whether the Crew tab flags this mech: destroyed, overheating, or an item destroyed. */
  attention: boolean
}

/** `SheetResult.vitals`, tagged so a reader need not trust `table` to narrow it. */
export type SheetVitals = ({ kind: 'pilot' } & PilotDerived) | ({ kind: 'mech' } & MechDerived)

/**
 * One Discord channel bound to a Game, or to one person's solo play
 * (`gameId: null`). Rolls made in Play post there (`channelBindings.postRoll`).
 */
export type ChannelBindingSummary = {
  channelId: string
  /**
   * The channel's name as it was when bound (`salvage-run`, no `#`), from the
   * interaction `/su bind` ran in; null on a binding made before names were
   * kept, or when Discord sent none.
   */
  channelName: string | null
  /** The Game whose rolls post here; null for a personal (solo) binding. */
  gameId: string | null
  gameName: string | null
}

/**
 * What the bot sends `bindChannel` (`/su bind`): who ran it, the channel it
 * ran in and its name, and the Game it named (its id, or a name typed by
 * hand), absent for solo play. `channelName` is optional on the wire: a bot
 * that predates it binds without one. `manageChannels` is whether the caller
 * holds Manage Channels in that channel, read from the interaction's
 * `member.permissions`; absent outside a server (a DM), where nobody holds it.
 */
export type BindChannelArgs = {
  discordId: string
  channelId: string
  channelName?: string
  game?: string
  manageChannels?: boolean
}

/**
 * The refusal, in a server, of `/su bind` without Manage Channels in the
 * channel: a channel is the server's, so its moderators decide where rolls
 * post. The bot says it before asking; the site says it to a bot that asks anyway.
 */
export const BIND_NEEDS_MANAGE_CHANNELS =
  'You need the Manage Channels permission in this channel to bind it.'

/** What the bot sends `unbindChannel` (`/su unbind`); `manageChannels` as for `bindChannel`. */
export type UnbindChannelArgs = {
  discordId: string
  channelId: string
  manageChannels?: boolean
}

/**
 * What `/su bind` did. `previousChannelId` is the channel the same Game (or the
 * same person's solo play) was bound to before, which this bind replaced: a
 * Game posts to one channel, and so does a person.
 */
export type BindChannelResult = {
  binding: ChannelBindingSummary
  previousChannelId: string | null
}

/** What `/su unbind` removed from the channel, or null when nothing was bound there. */
export type UnbindChannelResult = { unbound: ChannelBindingSummary | null }

/**
 * The reverse door: the site asking the bot to post, over its `BOT` service
 * binding to the bot's `Relay` (`apps/discord-bot/src/worker/relay.ts`). A
 * binding's `fetch` takes a whole URL; only its path is read (`relayUrl`).
 */
export type BotRelay = { fetch(input: string, init?: RequestInit): Promise<Response> }

/** A relay path as a binding's `fetch` takes it. */
export const relayUrl = (path: string): string => `https://relay${path}`

/**
 * A roll (`channelBindings.postRoll`). The bot holds the token and the roll
 * card (`buildPostedRollMessage`), so the posted message is exactly the card
 * `/su roll` posts, buttons and all.
 */
export const BOT_RELAY_POST_ROLL_PATH = '/relay/post-roll'

/** A roll as the card replays it (the table and its die, two on a columns table), and where. */
export type PostRollRelayRequest = {
  tableName: string
  rolls: number[]
  channelId: string
  /** Who rolled, for the card's context line ("rolled by …"). */
  roller?: string
  /** The roller's Discord id: the only person whose `Roll again` works. */
  ownerDiscordId?: string
}

/**
 * The Worker's answer. A failure carries Discord's HTTP status when Discord
 * answered (null when the card could not be built or Discord was unreachable)
 * and a sentence fit to show the roller.
 */
export type PostRollRelayResponse =
  | { ok: true; messageId: string }
  | { ok: false; status: number | null; message: string }

/**
 * The same door for a Stop Sign (`worker/shared/stopSign.ts`): a Game room
 * tells its bound channel that the game is paused, on a table that opted in. The message is the Worker's own fixed words, so nothing a
 * player typed reaches Discord this way. It answers as the roll relay does.
 */
export const BOT_RELAY_POST_STOP_PATH = '/relay/post-stop'

/** Where the Stop Sign posts. */
export type PostStopRelayRequest = { channelId: string }

/**
 * Whether a roll is one the card can replay: a named table and one die (two on
 * a columns table), each a whole number on the d20. The site checks it before
 * it relays (`channelBindings.postRoll`) and the relay again on receipt.
 */
export function isPostableRoll(tableName: string, rolls: readonly unknown[]): boolean {
  return (
    tableName.trim().length > 0 &&
    rolls.length >= 1 &&
    rolls.length <= 2 &&
    rolls.every((n) => typeof n === 'number' && Number.isInteger(n) && n >= 1 && n <= 20)
  )
}

/**
 * `usage`: one answered command, for the weekly tallies (ADR-057). `name` is
 * the command as `interactionName` spells it (`su roll`); `guildId` the server
 * it ran in, absent in a DM. Nothing about who ran it.
 */
export type BotUsageArgs = { name: string; guildId?: string }

/** `usage` answers only that it counted. */
export type BotUsageResult = { ok: true }

/** `feedback`: a `/su feedback` note, sent on for filing as a GitHub issue. */
export type BotFeedbackArgs = { discordId: string; kind: 'suggestion' | 'report'; text: string }

/** Whether the note was taken, and the words to show its sender either way. */
export type BotFeedbackResult = { ok: true; accepted: boolean; message: string }
