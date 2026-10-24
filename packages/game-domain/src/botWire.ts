/**
 * The wire shapes `botClient.ts` returns to the Discord bot (ADR-030).
 *
 * ONE declaration, two readers. `botClient.ts` annotates every handler's
 * success payload with these types, so changing what a handler returns without
 * changing this file fails to compile here; and the bot imports them with
 * `import type` (`apps/discord-bot/src/play/types.ts`), so the same change is a
 * compile error there too. A hand-copied shape would let a `botClient` change
 * compile cleanly on both sides and drift silently.
 *
 * ## Why this module imports nothing but `entityKinds`
 *
 * That is the whole reason it is separate from `apps/web/convex/model/bot.ts`.
 * Every file the bot imports is type-checked under the bot's settings —
 * including this one. `model/bot.ts` imports `_generated/*`, which would drag
 * Convex's generated data model (and the `convex` package the bot does not
 * depend on) into the bot's program. A leaf module (and `entityKinds.ts`, a
 * leaf too) is valid in both programs and costs the bot nothing at runtime, so
 * no Convex or React code can reach the Worker bundle through it.
 *
 * Keep it that way. Ids are plain `string` here — a Convex `Id<'games'>` is a
 * branded string and assigns to it, and on the wire it is only ever a string.
 *
 * The types still describe a network boundary, so the bot keeps reading them
 * defensively: bot and deployment ship separately, and a bot can meet a
 * deployment older than its own types. Shared declarations remove drift between
 * the two sources; they do not make a payload validated.
 */

import type { SheetTable } from './entityKinds'

/** Where the bot's HTTP door is mounted on the deployment: `/bot/<op>`. */
export const BOT_PATH_PREFIX = '/bot/'

/**
 * Every operation the bot may invoke through that door. The writes never touch
 * anybody's sheet: `bindChannel` and `unbindChannel` (`/su bind`, `/su
 * unbind`) are the bot's own apparatus, `usage` bumps a weekly command tally
 * and `feedback` hands on a `/su feedback` note (ADR-057).
 */
export const BOT_OP_NAMES = [
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
 * An entity body, exactly as Convex stores it — opaque.
 *
 * Convex cannot validate these (ADR-030: the client's Zod schemas in `apps/web/src` are the
 * source of truth and Convex stores bodies as `v.any()`), so the bot must not
 * pretend otherwise. Everything read off a body is read defensively, and the
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
   * deployment older than this field (Convex is pushed before the bot ships,
   * but a rolled-back backend still answers). Absent reads as "maxima
   * unknown", and the bot shows the current values alone.
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
 * that predates it binds without one.
 */
export type BindChannelArgs = {
  discordId: string
  channelId: string
  channelName?: string
  game?: string
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
 * The reverse door: Convex asking the bot Worker to post a roll
 * (`convex/channelBindings.ts#postRoll` → `apps/discord-bot/src/worker/relay.ts`).
 *
 * The Worker holds the bot token and the roll card (`buildPostedRollMessage`),
 * so the posted message is exactly the card `/su roll` posts, buttons and all.
 * Authenticated with the same `BOT_SECRET` as `/bot/*`, in the other
 * direction.
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
 * The same door for a Stop Sign (`convex/safety.ts#postStop`): Convex asks the
 * Worker to tell a Game's bound channel that the game is paused, on a table
 * that opted in. The message is the Worker's own fixed words, so nothing a
 * player typed reaches Discord this way. It answers as the roll relay does.
 */
export const BOT_RELAY_POST_STOP_PATH = '/relay/post-stop'

/** Where the Stop Sign posts. */
export type PostStopRelayRequest = { channelId: string }

/**
 * Whether a roll is one the card can replay: a named table and one die (two on
 * a columns table), each a whole number on the d20. Convex checks it before it
 * relays (`channelBindings.postRoll`) and the relay again on receipt.
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
 * Compare two secrets without leaking their common prefix through timing:
 * `BOT_SECRET` as Convex's `/bot/*` and the bot's relay each check it.
 *
 * Length is compared first and short-circuits, which does leak the secret's
 * length — that is accepted: a length oracle does not meaningfully narrow a
 * random secret, whereas a byte-by-byte early exit would.
 */
export function secretsMatch(presented: string, expected: string): boolean {
  if (presented.length !== expected.length) return false
  let diff = 0
  for (let i = 0; i < presented.length; i += 1) {
    diff |= presented.charCodeAt(i) ^ expected.charCodeAt(i)
  }
  return diff === 0
}

/**
 * Pull the bearer token out of an Authorization header.
 * Returns null for a missing, malformed, or non-bearer header.
 */
export function bearerToken(header: string | null): string | null {
  if (header === null) return null
  const match = /^Bearer (.+)$/.exec(header.trim())
  return match?.[1] ?? null
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
