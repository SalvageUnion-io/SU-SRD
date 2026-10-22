import { authTables } from '@convex-dev/auth/server'
import { defineSchema, defineTable } from 'convex/server'
import { v } from 'convex/values'
import { zodToConvex } from 'convex-helpers/server/zod4'
import { CHANGE_LOG_KINDS } from 'game-domain/schemas/changeLog'
import { EntityRefSchema } from 'game-domain/schemas/entity'
import { CrewSlotSchema, SoftLinkSchema } from 'game-domain/schemas/softLink'
import { playTables } from './model/playTables'
import { literalUnion } from './model/validators'

/**
 * Convex schema for the app accounts, Games, and entity ownership.
 *
 * This is the server of record introduced by ADR-030, which
 * supersedes ADR-001's "no backend, no auth". See docs/ARCHITECTURE.md#convex
 * and ADR-030 for the full record; the short version of what this file assumes:
 *
 *   - Two containers, not one (ADR-030 §2). An entity lives in a shared `games` row OR
 *     on its owner's personal shelf. Null `gameId` MEANS shelf (Play's tables: absent = solo).
 *   - Ownership is nullable too (ADR-030 §2). A null `ownerId` is an *unclaimed*
 *     entity — a normal state, arising when a player leaves, when the
 *     Mediator pre-builds a character, or from a Game template.
 *   - `gameId == null && ownerId == null` is the one invalid combination. It is
 *     unreachable through any mutation and should stay that way.
 *
 * ## Why entity bodies are `v.any()`
 *
 * `Pilot`, `Mech`, and `Crawler` are large Zod schemas in `game-domain/schemas/`,
 * and those schemas are the single source of truth — `schemas/*.schema.json` in
 * `salvageunion-reference` is already generated from Zod at build time.
 * Re-declaring every field as a Convex validator would fork that source of truth
 * into a second, hand-maintained copy that silently rots.
 *
 * So Convex validates and indexes what it needs to *query* — ownership, scoping,
 * timestamps — and treats the entity body as an opaque payload that Zod parses
 * at the edge.
 * The trade is real and worth naming: Convex cannot reject a malformed body on
 * write, so every mutation MUST parse with the Zod schema before persisting.
 *
 * ## …but a field that is already a closed set is declared as one
 *
 * The `v.any()` bodies above are the *only* place we give up validation. Where a
 * column's values are a short, closed list that some Zod schema already names,
 * it is declared as a `v.union` of literals rather than a `v.string()` with the
 * list in a comment. A comment is not checked: typed as `string`,
 * `Doc<'changeLog'>['state']` would let `row.state === 'proposed'` compare two
 * arbitrary strings, so a typo would read as "no rows match" rather than as a
 * type error. Each union below is that list, checked, and kept in step with its Zod
 * counterpart in `game-domain/schemas/`.
 *
 * Where the Zod side is a schema, the validator is built from it with
 * `zodToConvex` (convex-helpers), and where it is only a list of names, from
 * that list (`literalUnion`), so there is nothing to keep in step. What Zod
 * refines beyond the shape (a `.min(1)`, a `superRefine`) Convex does not
 * check; the mutation's Zod parse still does. `mirrors` checks a validator
 * still written out against the type it stands for: the `seats` row, the
 * crew statuses `crew.vitals` returns (both helpers: `model/validators.ts`).
 *
 * Play's tables (the seat, the Game's Downtime and the Discord channel
 * bindings) and their validators are `model/playTables.ts`, spread in below.
 *
 * The function modules take their arguments and declare their `returns`
 * against these same validators, never a hand-copied union.
 */

/**
 * `EntityRefSchema.type` (game-domain/schemas/entity) — ADR-027.
 *
 * Exported so a mutation that takes an endpoint as an *argument* validates it
 * against this same union rather than a hand-copied one. `entities.upsertSoftLink`
 * is the caller; a second copy there is exactly the drift the header warns about.
 */
export const entityRefType = zodToConvex(EntityRefSchema.shape.type)

/** `EntityRefSchema` (game-domain/schemas/entity): a link end, by kind and app id. */
export const entityRef = v.object({ type: entityRefType, id: v.string() })

/**
 * `SoftLinkSchema.type` (game-domain/schemas/softLink). Exported: see above.
 *
 * `mech-to-crawler` (ADR-037): a mech's crawler is its own link, not reached
 * through its pilot. Adding a literal is the backward-compatible direction —
 * every existing row still validates.
 */
export const softLinkType = zodToConvex(SoftLinkSchema.shape.type)

/**
 * `CrewSlotSchema` (game-domain/schemas/softLink) — ADR-044. The crew
 * slot an `npc-to-crawler` link fills: a bay by its slug, or the crawler
 * type's NPC. Required on that type and refused on every other, which the
 * writers in `entities.ts` enforce (a validator cannot see the link's type).
 */
export const crewSlot = zodToConvex(CrewSlotSchema)

/**
 * What a Change Log row is about: one of the player entities, or the Game.
 *
 * `'game'` names no sheet: a table-wide alert (`proposals.broadcast`), a
 * Discord roll the bot logged and a Play roll
 * (`appendChangeLog`, from `playRolls.model.ts`) are log rows about the Game
 * itself rather than about anybody's sheet. Everything that reads a row's target must therefore handle a
 * row that names no entity table — see `ownableTableFor` in `proposals.ts`.
 *
 * Exported so `changeLog.appendChangeLog` validates its entries against this
 * union rather than a hand-copied one, as `entityRefType` is above.
 */
export const changeLogEntityType = v.union(
  ...entityRefType.members,
  v.literal('softLink'),
  v.literal('game')
)

/**
 * `CHANGE_LOG_KINDS` (game-domain/schemas/changeLog) — ADR-022. Exported so
 * `changeLog.appendChangeLog` takes its entries' `kind` against this union.
 */
export const changeLogKind = literalUnion(CHANGE_LOG_KINDS)

/**
 * Proposal lifecycle (ADR-030 §4). No Zod counterpart: proposals are made and
 * answered only on the server. Exported for the reads that return it.
 */
export const changeLogState = v.union(
  v.literal('applied'),
  v.literal('proposed'),
  v.literal('declined'),
  v.literal('superseded')
)

/**
 * `invites.role`: new invites leave it unset; `'mediator'` survives on older
 * rows until `invites.dropRetired` clears it.
 */

/**
 * The tables an entity can be handed over from: a pilot or a mech, never the
 * communal crawler. `ownership` and `entities.remove` take them.
 */
export const ownableTable = v.union(v.literal('pilots'), v.literal('mechs'))

/** Whether an addressed invite's `/su invite` DM went out (`invites.delivery`). */
const inviteDeliveryState = v.union(v.literal('queued'), v.literal('sent'), v.literal('failed'))

/** A Game's denormalised summary (`games.summary`), as `games.listMine` returns it too. */
export const gameSummary = v.object({
  memberCount: v.number(),
  pilotCount: v.number(),
  mechCount: v.number(),
  /** The primary crawler's name, or null before one exists. */
  crawlerName: v.union(v.string(), v.null()),
})

/** The columns and indexes `pilots`, `mechs`, `crawlers` and `npcs` share: one table shape, four tables. */
function containerTable() {
  return (
    defineTable({
      gameId: v.union(v.id('games'), v.null()),
      ownerId: v.union(v.id('users'), v.null()),
      /**
       * The app-level UUID this row carries (ADR-030 §1).
       *
       * Convex mints its own `_id`, so a client holding only the local UUID
       * would have nothing to address a row by for updates and deletes. Carrying the
       * app id as an indexed column gives one cheap lookup per write instead of
       * a mapping table, and keeps `_id` idiomatic for everything server-side.
       *
       * Optional because rows created server-side (Game templates) have no local
       * counterpart until somebody claims them.
       */
      appId: v.optional(v.string()),
      /**
       * Whether this entity is readable by anybody, with no account
       * ([ADR-032](../../../docs/adr/032-public-read-only-sheets.md)).
       *
       * A column rather than a body field because it is a **visibility** fact,
       * which is server state in the same way `gameId` and `ownerId` are — and
       * because the body is `v.any()`, so nothing here could enforce it.
       *
       * Absent means not public. That is the existing rule (ADR-030 §5:
       * visibility begins at membership) and therefore the correct default for
       * every row that already exists.
       */
      publicRead: v.optional(v.boolean()),
      body: v.any(),
      updatedAt: v.number(),
    })
      .index('by_game', ['gameId'])
      // `ownerId` alone is a prefix of this, so it also serves every "all of
      // mine" read; the second column is for "mine on the shelf" (`gameId:
      // null`), so that read never collects everything the owner holds.
      .index('by_owner_game', ['ownerId', 'gameId'])
      .index('by_app_id', ['appId'])
  )
}

export default defineSchema({
  // Auth tables from @convex-dev/auth: authAccounts, authSessions, etc.
  // `users` is extended below with the profile fields the owner chip reads.
  ...authTables,

  users: defineTable({
    name: v.optional(v.string()),
    email: v.optional(v.string()),
    image: v.optional(v.string()),
    emailVerificationTime: v.optional(v.number()),
    isAnonymous: v.optional(v.boolean()),
    // Carried over from `authTables.users` even though Discord is the only
    // provider: overriding that table means anything the library expects to
    // find has to be redeclared here, and a missing field would surface as a
    // write failure inside the auth flow rather than as a type error.
    phone: v.optional(v.string()),
    phoneVerificationTime: v.optional(v.number()),

    /**
     * Overridable display name (ADR-030 §6). Defaults from Discord but is editable —
     * people use different names at different tables. This is what every owner
     * chip renders, so it is read far more often than it is written.
     */
    displayName: v.optional(v.string()),
    /** Overridable avatar. Falls back to the Discord `image` above. */
    avatarUrl: v.optional(v.string()),
  })
    .index('email', ['email'])
    .index('phone', ['phone']),

  /**
   * A Game is the shared container — campaign and group in one concept
   * (ADR-030 §2). Membership lives in `memberships`, never
   * as an array here, so authorization is a single indexed lookup.
   */
  games: defineTable({
    name: v.string(),
    /** Which built-in template seeded this Game, if any. */
    templateOrigin: v.optional(v.string()),
    /**
     * What a Game's summary says about this table — kept current by the triggers
     * in `model/entities.ts`, never written by a mutation directly.
     *
     * Denormalised because `games.listMine` is subscribed from several screens
     * at once: deriving these from every membership, pilot, mech and crawler
     * would make the list as expensive as the whole account, and — because it
     * is reactive — re-run it on an HP tick on anybody's sheet in any of your
     * Games. Read from here, the list depends on one document per Game, and that
     * document changes only when one of these four values does.
     *
     * Optional because a Game is inserted before the membership whose trigger
     * first fills it; `summaryOf` computes it live for a row that has none.
     */
    summary: v.optional(gameSummary),
    /**
     * The crawler every pilot and mech is assigned to on entering this Game
     * (ADR-037 — the primary crawler).
     *
     * Written by the server only: the first crawler to arrive becomes primary,
     * a primary that is scrapped or moved out falls back to the oldest crawler
     * left (or null), and the table runner may name another
     * (`games.setPrimaryCrawler`). Changing it moves nobody — assignment is an
     * explicit link written when an entity enters the Game.
     *
     * Optional: absent means "the oldest crawler here", which is what
     * `primaryCrawlerOf` resolves it to, for the Game summary and the bot.
     */
    primaryCrawlerId: v.optional(v.union(v.id('crawlers'), v.null())),
  }),

  /**
   * Membership = (account x Game), and the only place capabilities live.
   *
   * Booleans rather than a role enum, deliberately (ADR-030 §3): a Mediator who
   * also plays needs both, and the Organizer is an *orthogonal* administrative
   * flag layered on whichever base role the member holds — never a third role.
   * Exactly one membership per Game carries `organizer: true`.
   */
  memberships: defineTable({
    gameId: v.id('games'),
    userId: v.id('users'),
    mediator: v.boolean(),
    organizer: v.boolean(),
    joinedAt: v.number(),
  })
    .index('by_game', ['gameId'])
    .index('by_user', ['userId'])
    .index('by_game_user', ['gameId', 'userId']),

  /**
   * Invites. A Game has one invite URL, `/invite/<code>`: the newest open
   * `standing` row not yet `revokedAt` (`model/invites.ts#currentInvite`).
   * Opening it joins as a player; every other row opens nothing. `target`,
   * `declinedAt`, `delivery` and `sourceInteractionId` are read by nothing, and
   * go once the last addressed invite has expired.
   */
  invites: defineTable({
    gameId: v.id('games'),
    /** The link token. The column keeps its name: rows minted as typed codes still resolve. */
    code: v.string(),
    createdBy: v.id('users'),

    createdAt: v.number(),

    /** Set when the Organizer resets the Game's invite URL: this code stops working. */
    revokedAt: v.optional(v.number()),

    /** Who an addressed invite (ADR-039) was for. */
    target: v.optional(
      v.object({
        kind: v.literal('discord'),
        discordId: v.string(),
        name: v.optional(v.string()),
      })
    ),

    declinedAt: v.optional(v.number()),

    delivery: v.optional(
      v.object({
        state: inviteDeliveryState,
        at: v.number(),
        /** A short reason for a failure, worded for the Organizer. */
        detail: v.optional(v.string()),
      })
    ),

    sourceInteractionId: v.optional(v.string()),

    /** Marks a row that can be the Game's invite URL (`invites.link`, `invites.reset`). */
    standing: v.optional(v.boolean()),
  })
    .index('by_code', ['code'])
    .index('by_game', ['gameId']),

  pilots: containerTable(),

  mechs: containerTable(),

  /**
   * The crawler is communal **inside a Game** (ADR-030 §5) — `ownerId: null` — and every
   * member reads it, but only the table runner writes it (amended by ADR-038 §5:
   * the Mediator keeps the crawler; `assertMayEditCrawler`). Writes resolve by
   * field-level merge (ADR-030 §5), enforced in the mutation rather than the schema, so
   * a write from a stale copy never undoes a field it did not touch.
   *
   * ## On a shelf too, like `pilots`/`mechs`
   *
   * A crawler can sit on a shelf: `gameId: null` with an owner, ADR-030 §2's
   * third row. So deleting a Game falls its crawler back to a shelf, as it does
   * pilots and mechs, rather than destroying the crew's home. A device-only copy
   * of a shelved crawler is rejected on principle: offline-first here is
   * ordinary PWA caching, so the local store is a *reflection* of Convex and
   * never a second source of truth. A record with no server row to reflect is
   * invisible on the player's other devices and lost with the browser's storage.
   *
   * `ownerId` is null while the crawler is in a Game — that is what communal
   * means (ADR-030 §5) — and set only on the shelf. `gameId == null && ownerId
   * == null` stays the one invalid combination, for the crawler exactly as for
   * everything else.
   */
  crawlers: containerTable(),

  /**
   * A built NPC (ADR-044): owned exactly like a pilot, with the pilot's
   * columns. On its owner's shelf or in a Game, readable by the Game's members,
   * written only by its owner, public only by `publicRead` (ADR-032). Never an
   * `encounterNpcs` row: that tray holds reference instances (ADR-034).
   */
  npcs: containerTable(),

  /**
   * An assignment: 'mech-to-pilot' | 'pilot-to-crawler' | 'mech-to-crawler' |
   * 'npc-to-crawler'. Partners never widen EntityRef (ADR-028); a built NPC is
   * an entity of its own, so it does (ADR-044).
   *
   * Identity is the (from, to, type) triple — endpoints are app ids, so a link
   * needs no `appId` of its own. Three invariants hold for every row, and the
   * writers in `entities.ts` / `model/entities.ts` keep them (ADR-037):
   *
   *   - **cardinality** — a pilot crews ≤1 crawler and flies ≤1 mech; a mech
   *     flies ≤1 pilot and docks in ≤1 crawler; an NPC fills ≤1 crew slot and
   *     a slot holds ≤1 NPC. Drawing a link replaces the ones it conflicts
   *     with (`conflictingLinks` in `game-domain/links/linkRules`).
   *   - **one container** — both ends share a Game, or the same owner's shelf.
   *   - **`gameId` is that container** — it moves with its ends, and a move that
   *     would leave a link straddling two containers deletes it instead.
   */
  softLinks: defineTable({
    gameId: v.union(v.id('games'), v.null()),
    from: entityRef,
    to: entityRef,
    type: softLinkType,
    /** The crew slot of an `npc-to-crawler` link; absent on every other type. */
    slot: v.optional(crewSlot),
  })
    .index('by_game', ['gameId'])
    .index('by_from', ['from.id'])
    .index('by_to', ['to.id']),

  /**
   * An NPC, in exactly one of the two containers everything else uses
   * ([ADR-034](../../../docs/ARCHITECTURE.md#decisions)
   * decision 2).
   *
   * In a Game (`gameId` set, `ownerId: null`) it is the **Mediator's prepared
   * opposition** — the one table members cannot read. On a shelf (`gameId:
   * null`, `ownerId` set) it is somebody's own tray, where they prep before a
   * Game exists or after one ends.
   */
  encounterNpcs: defineTable({
    gameId: v.union(v.id('games'), v.null()),
    /**
     * Null inside a Game — the tray belongs to the table, not to a member, and
     * the Mediator reaches it through their role rather than through ownership.
     * Set on a shelf, where a container with no owner would be the invalid row.
     */
    ownerId: v.union(v.id('users'), v.null()),
    /**
     * The id inside the body, lifted into a column so a write can find its row
     * with one indexed read. See `mechPatterns.appId` — same reason.
     */
    appId: v.string(),
    body: v.any(),
  })
    .index('by_game', ['gameId'])
    .index('by_owner_app_id', ['ownerId', 'appId']),

  /**
   * A saved mech pattern. Always its maker's: `ownerId` is set on every
   * row, and only the maker writes it.
   *
   * Who may READ it is the maker's choice of three, held in two columns:
   *
   * | Visibility           | `publicRead` | `gameId`  |
   * | -------------------- | ------------ | --------- |
   * | Only me              | false/absent | null      |
   * | Anyone with the link | true         | null      |
   * | My Game's crew       | false/absent | that Game |
   *
   * `publicRead` is the same opt-in the sheets carry (ADR-032), served by the
   * same unauthenticated module (`publicSheet.pattern`). `gameId` here is a
   * **read scope**, not a container: a pattern never moves into a Game the way
   * a pilot does, has no `body.gameId` to keep in step, and stays on its
   * maker's shelf whatever it is shared with.
   */
  mechPatterns: defineTable({
    ownerId: v.id('users'),
    gameId: v.union(v.id('games'), v.null()),
    /**
     * The id inside the body (`body.id`), lifted into a column so a write
     * finds its row with one read on `by_owner_app_id`, and the pattern page
     * finds it on `by_app_id`.
     */
    appId: v.string(),
    body: v.any(),
    /** Readable with no account at `/p/pattern/:appId` (ADR-032). */
    publicRead: v.optional(v.boolean()),
    /** When it was last shared (link or crew), for the page's foot. */
    sharedAt: v.optional(v.number()),
    /**
     * How many mechs have been built from it: counted by the mech create that
     * carries `body.sourcePattern`, so the page reads one number, not a scan.
     */
    builtCount: v.optional(v.number()),
  })
    // `ownerId` alone is a prefix, so this also serves "all of mine".
    .index('by_owner_app_id', ['ownerId', 'appId'])
    .index('by_app_id', ['appId'])
    .index('by_game', ['gameId']),

  /**
   * One row per uploaded entity photo in file storage (`photos.ts`).
   *
   * The file is referenced from inside entity bodies (`body.photo`), which
   * Convex cannot index, so this row is the file's bookkeeping: who uploaded
   * it and how many entity rows hold it. The entity triggers in
   * `model/entities.ts` keep `refs` current on every write and delete, and
   * delete the file when the last holder lets go; the hourly sweep deletes a
   * claimed file no entity ever took up.
   */
  photos: defineTable({
    storageId: v.id('_storage'),
    ownerId: v.id('users'),
    /** Entity rows whose body holds this file. */
    refs: v.number(),
    claimedAt: v.number(),
  })
    .index('by_storage', ['storageId'])
    .index('by_refs_claimed', ['refs', 'claimedAt']),

  /**
   * The Change Log (ADR-022), promoted from a local-only audit trail to the
   * synchronized spine of the whole feature.
   *
   * It is simultaneously the audit trail, the sync log, and the alert bus: a
   * Mediator's proposal is simply an entry in `proposed` state that the player
   * commits by applying it. `supersededBy` implements ADR-030 §4 — a newer proposal
   * against the same (entityId, field) retires the older one, so a player never
   * faces two contradictory pending changes to one value. Nothing expires and
   * nothing is ever force-applied.
   */
  changeLog: defineTable({
    gameId: v.union(v.id('games'), v.null()),
    entityType: changeLogEntityType,
    entityId: v.string(),
    ts: v.number(),
    kind: changeLogKind,
    field: v.string(),
    before: v.any(),
    after: v.any(),
    /**
     * The surface that made the change, e.g. 'live-sheet', 'play',
     * 'mediator-proposal', 'ownership', 'discord-bot'.
     *
     * Deliberately left open where its neighbours are closed unions: a surface
     * is a fact about where a write came from, and a new one appears every time
     * a new screen or client lands. Closing it would make adding a surface a
     * schema migration and would reject the log rows a client sends from a
     * build newer than the deployment.
     */
    source: v.string(),
    /** Who performed or proposed it. */
    actorId: v.union(v.id('users'), v.null()),
    state: changeLogState,
    supersededBy: v.optional(v.id('changeLog')),
    /**
     * Why the Mediator is asking, on a proposal: "Rifle Squad volley".
     * At most `PROPOSAL_REASON_MAX` characters, and optional — a proposal
     * without one is still a proposal. The player reads it beside the value.
     */
    reason: v.optional(v.string()),
  })
    // `entityId` alone is a prefix of this. The rest is for `proposals.propose`,
    // which supersedes live proposals against one field without collecting an
    // entity's entire history to find them.
    .index('by_entity_state_field', ['entityId', 'state', 'field'])
    // `changeLog.forEntity`: one entity's applied or proposed rows, newest
    // first, read `MAX_ENTITY_ROWS` at a time rather than collected — every
    // write appends a row, so the entity's whole history grows without limit.
    .index('by_entity_state_ts', ['entityId', 'state', 'ts'])
    // `gameId` alone is a prefix of this. `ts` last so `proposals.alerts` can
    // read the newest N alerts in order instead of the whole log.
    .index('by_game_field', ['gameId', 'field', 'ts'])
    .index('by_game_state', ['gameId', 'state'])
    // `proposals.sent`: one surface's rows in one Game, newest first, without
    // reading a log that grows all campaign (`source` is 'mediator-proposal').
    .index('by_game_source_ts', ['gameId', 'source', 'ts']),

  ...playTables,
})
