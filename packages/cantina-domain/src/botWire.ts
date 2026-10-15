/**
 * The wire shapes `botClient.ts` returns to the Discord bot (ADR-030).
 *
 * ONE declaration, two readers. `botClient.ts` annotates every handler's
 * success payload with these types, so changing what a handler returns without
 * changing this file fails to compile here; and the bot imports them with
 * `import type` (`apps/discord-bot/src/cantina/types.ts`), so the same change is a
 * compile error there too. A hand-copied shape would let a `botClient` change
 * compile cleanly on both sides and drift silently.
 *
 * ## Why this module imports NOTHING
 *
 * That is the whole reason it is separate from `apps/cantina/convex/model/bot.ts`.
 * Every file the bot imports is type-checked under the bot's settings —
 * including this one. `model/bot.ts` imports `_generated/*`, which would drag
 * Convex's generated data model (and the `convex` package the bot does not
 * depend on) into the bot's program. A leaf module with no imports is valid in
 * both programs and costs the bot nothing at runtime: `import type` is erased,
 * so no Convex or React code can reach the Worker bundle through it.
 *
 * Keep it that way. Ids are plain `string` here — a Convex `Id<'games'>` is a
 * branded string and assigns to it, and on the wire it is only ever a string.
 *
 * The types still describe a network boundary, so the bot keeps reading them
 * defensively: bot and deployment ship separately, and a bot can meet a
 * deployment older than its own types. Shared declarations remove drift between
 * the two sources; they do not make a payload validated.
 */

/**
 * Why the bot could not act, when it could not: no Cantina account carries this
 * Discord id (`unlinked`), or the sheet asked for is absent or not the
 * caller's to read (`not-found`, one answer for both so neither discloses).
 *
 * The bot renders each into an **ephemeral** reply, visible only to the person
 * who asked, so a public channel never learns who holds an account. Returned
 * rather than thrown because neither is exceptional.
 */
export type BotDenialReason = 'unlinked' | 'not-found'

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
 * Convex cannot validate these (ADR-030: the Zod schemas in `apps/cantina` are the
 * source of truth and Convex stores bodies as `v.any()`), so the bot must not
 * pretend otherwise. Everything read off a body is read defensively, and the
 * derived maxima come from `salvageunion-reference/rules` rather than from any
 * field claimed to be here.
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

/** The tables `/su sheet` can open. The crawler is communal and has no owner. */
export type SheetTable = 'pilots' | 'mechs' | 'crawlers'

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
}
