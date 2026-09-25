/**
 * The wire shapes `botClient.ts` returns to the Discord bot (ADR-030 Phase 6).
 *
 * ONE declaration, two readers. `botClient.ts` annotates every handler's
 * success payload with these types, so changing what a handler returns without
 * changing this file fails to compile here; and the bot imports them with
 * `import type` (`apps/discord-bot/src/itun/types.ts`), so the same change is a
 * compile error there too. The bot used to hand-copy these shapes, which meant
 * a `botClient` change compiled cleanly on both sides and drifted silently.
 *
 * ## Why this module imports NOTHING
 *
 * That is the whole reason it is separate from `model/bot.ts`. The bot
 * type-checks under `moduleResolution: nodenext`, and every file it imports is
 * type-checked under the bot's settings — including this one. `model/bot.ts`
 * imports `_generated/*` extensionlessly, which nodenext rejects, and would drag
 * Convex's generated data model into the bot's program besides. A leaf module
 * with no imports is valid under both configurations and costs the bot nothing
 * at runtime: `import type` is erased, so no Convex or React code can reach the
 * Worker bundle through it.
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
 * Why the bot could not act, when it could not — the three resolution cases.
 *
 * Three distinct causes with one deliberate property: the *bot* learns which
 * one it was, and a *public channel* never does. Distinguishing them in chat
 * would announce who holds an account and who sits at which table, so the bot
 * renders every one of these into an **ephemeral** reply — visible only to the
 * person who asked, which leaks nothing while still explaining itself.
 *
 * Returned rather than thrown because none of the three is exceptional. Not
 * being in a Game is the ordinary condition of most people in most channels.
 */
export type BotDenial =
  /** No ITUN account carries this Discord id. */
  | 'unlinked'
  /** This channel speaks for no Game. */
  | 'unbound'
  /** Linked and bound, but not a member of *that* Game. */
  | 'not-a-member'

/** Every reason a bot call can be refused: `BotDenial` plus the mutation cases. */
export type BotDenialReason = BotDenial | 'forbidden' | 'not-found'

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
 * Convex cannot validate these (ADR-030: the Zod schemas in `apps/itun` are the
 * source of truth and Convex stores bodies as `v.any()`), so the bot must not
 * pretend otherwise. Everything read off a body is read defensively, and the
 * derived maxima come from `salvageunion-reference/rules` rather than from any
 * field claimed to be here.
 */
export type EntityBody = Record<string, unknown>

/** A pilot or mech on a shelf: no owner to name, because the owner is the caller. */
export type ShelfEntity = { id: string; appId: string | null; body: EntityBody }

export type ShelfResult = {
  pilots: ShelfEntity[]
  mechs: ShelfEntity[]
}

export type OwnedEntity = {
  id: string
  /**
   * The app-level id, or null.
   *
   * Deep links use THIS, never `id`: the web sheet route resolves an entity out
   * of IndexedDB by its app-level id, so a URL built from the Convex `_id`
   * opens nothing. Null means nobody has claimed the entity into a browser yet,
   * and the bot renders the name without a link rather than a dead one.
   */
  appId: string | null
  ownerId: string | null
  ownerName: string | null
  body: EntityBody
}

export type CrewResult = {
  game: { gameId: string; name: string }
  viewerId: string
  pilots: OwnedEntity[]
  mechs: OwnedEntity[]
  crawler: { id: string; body: EntityBody } | null
}

export type ChannelResult = {
  game: { gameId: string; name: string }
  members: {
    userId: string
    displayName: string
    mediator: boolean
    organizer: boolean
  }[]
  downtime: {
    running: boolean
    stepIndex: number | null
    completed: number
    upkeepSpent: boolean
  }
}

/** The tables `/su sheet` can open. The crawler is communal and has no owner. */
export type SheetTable = 'pilots' | 'mechs' | 'crawlers'

export type SheetResult = {
  table: SheetTable
  id: string
  appId: string | null
  /**
   * The Game this sheet belongs to.
   *
   * Load-bearing for the link: the read-only web view is addressed as
   * `/games/<gameId>/view/<kind>/<convexId>`, and it is the only route that
   * resolves a *crewmate's* entity — `/sheet/<kind>/<appId>` reads the clicker's
   * own IndexedDB, so it opens nothing for anybody but the owner.
   */
  gameId: string
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

export type BindResult = { name: string }

export type RecordRollResult = { game: string }
