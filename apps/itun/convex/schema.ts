import { authTables } from '@convex-dev/auth/server'
import { defineSchema, defineTable } from 'convex/server'
import { v } from 'convex/values'

/**
 * Convex schema for ITUN accounts, Games, and entity ownership.
 *
 * This is the server-of-record introduced by the accounts plan (D1/D2), which
 * supersedes ADR-001's "no backend, no auth". See docs/architecture/ for the
 * full decision record; the short version of what this file assumes:
 *
 *   - Two containers, not one (D18). An entity lives in a shared `games` row OR
 *     on its owner's personal shelf. `gameId` is nullable and null MEANS shelf.
 *   - Ownership is nullable too (D28). A null `ownerId` is an *unclaimed*
 *     entity — a normal state, arising when a player leaves (D16), when the
 *     Mediator pre-builds a character, or from a Game template (D34).
 *   - `gameId == null && ownerId == null` is the one invalid combination. It is
 *     unreachable through any mutation and should stay that way.
 *
 * ## Why entity bodies are `v.any()`
 *
 * `Pilot`, `Mech`, and `Crawler` are large Zod schemas in `src/lib/schemas/`,
 * and those schemas are the single source of truth — `schemas/*.schema.json` in
 * `salvageunion-reference` is already generated from Zod, and CI fails on drift.
 * Re-declaring every field as a Convex validator would fork that source of truth
 * into a second, hand-maintained copy that silently rots.
 *
 * So Convex validates and indexes what it needs to *query* — ownership, scoping,
 * timestamps — and treats the entity body as an opaque payload that Zod parses
 * at the edge, exactly as `SnapshotStorage` already treats snapshot payloads.
 * The trade is real and worth naming: Convex cannot reject a malformed body on
 * write, so every mutation MUST parse with the Zod schema before persisting.
 */
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

    /** Discord snowflake, once linked. The only third-party identifier stored. */
    discordId: v.optional(v.string()),
    /**
     * Overridable display name (D33). Defaults from Discord but is editable —
     * people use different names at different tables. This is what every owner
     * chip renders, so it is read far more often than it is written.
     */
    displayName: v.optional(v.string()),
    /** Overridable avatar. Falls back to the Discord `image` above. */
    avatarUrl: v.optional(v.string()),
  })
    .index('email', ['email'])
    .index('phone', ['phone'])
    .index('by_discord', ['discordId']),

  /**
   * A Game is the shared container — campaign, group, and (formerly) workspace
   * collapsed into one concept (D4). Membership lives in `memberships`, never
   * as an array here, so authorization is a single indexed lookup.
   */
  games: defineTable({
    name: v.string(),
    /** Which built-in template seeded this Game, if any (D34). */
    templateOrigin: v.optional(v.string()),
    /** Dashboard dial show/hide + order. Carried over from Workspace unchanged. */
    cockpitPrefs: v.optional(v.any()),
  }),

  /**
   * Membership = (account x Game), and the only place capabilities live.
   *
   * Booleans rather than a role enum, deliberately (D15/D20): a Mediator who
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

  /** Invite codes (closes the intent of legacy issue #157). */
  invites: defineTable({
    gameId: v.id('games'),
    code: v.string(),
    createdBy: v.id('users'),
    expiresAt: v.optional(v.number()),
    usesRemaining: v.optional(v.number()),
  })
    .index('by_code', ['code'])
    .index('by_game', ['gameId']),

  pilots: defineTable({
    gameId: v.union(v.id('games'), v.null()),
    ownerId: v.union(v.id('users'), v.null()),
    /**
     * The app-level UUID this row mirrors (ADR-030 §1).
     *
     * Convex mints its own `_id`, so a client holding only the local UUID has
     * nothing to address a row by — which is what made an earlier
     * write-mirroring attempt unworkable for updates and deletes. Carrying the
     * app id as an indexed column gives one cheap lookup per write instead of
     * a mapping table, and keeps `_id` idiomatic for everything server-side.
     *
     * Optional because rows created server-side (Game templates) have no local
     * counterpart until somebody claims them.
     */
    appId: v.optional(v.string()),
    body: v.any(),
    updatedAt: v.number(),
  })
    .index('by_game', ['gameId'])
    .index('by_owner', ['ownerId'])
    .index('by_app_id', ['appId']),

  mechs: defineTable({
    gameId: v.union(v.id('games'), v.null()),
    ownerId: v.union(v.id('users'), v.null()),
    /**
     * The app-level UUID this row mirrors (ADR-030 §1).
     *
     * Convex mints its own `_id`, so a client holding only the local UUID has
     * nothing to address a row by — which is what made an earlier
     * write-mirroring attempt unworkable for updates and deletes. Carrying the
     * app id as an indexed column gives one cheap lookup per write instead of
     * a mapping table, and keeps `_id` idiomatic for everything server-side.
     *
     * Optional because rows created server-side (Game templates) have no local
     * counterpart until somebody claims them.
     */
    appId: v.optional(v.string()),
    body: v.any(),
    updatedAt: v.number(),
  })
    .index('by_game', ['gameId'])
    .index('by_owner', ['ownerId'])
    .index('by_app_id', ['appId']),

  /**
   * The crawler is communal (D8) — no `ownerId` at all, and any member of the
   * Game may write it. Conflicting writes resolve by field-level merge (D19),
   * which is enforced in the mutation rather than the schema; the contended
   * fields in practice are the scrap pool and cargo lots during Downtime.
   */
  crawlers: defineTable({
    gameId: v.id('games'),
    /** See `pilots.appId` — same reason, same lookup path. */
    appId: v.optional(v.string()),
    body: v.any(),
    updatedAt: v.number(),
  })
    .index('by_game', ['gameId'])
    .index('by_app_id', ['appId']),

  /** 'mech-to-pilot' | 'pilot-to-crawler'. EntityRef is NOT widened (ADR-027). */
  softLinks: defineTable({
    gameId: v.union(v.id('games'), v.null()),
    from: v.object({ type: v.string(), id: v.string() }),
    to: v.object({ type: v.string(), id: v.string() }),
    type: v.string(),
  })
    .index('by_game', ['gameId'])
    .index('by_from', ['from.id'])
    .index('by_to', ['to.id']),

  /** Mediator-owned and Mediator-visible. The one thing that must stay hidden. */
  encounterNpcs: defineTable({
    gameId: v.id('games'),
    body: v.any(),
  }).index('by_game', ['gameId']),

  /** Personal by default; `sharedToGame` exposes it to the crew (D26). */
  mechPatterns: defineTable({
    ownerId: v.id('users'),
    gameId: v.union(v.id('games'), v.null()),
    sharedToGame: v.boolean(),
    body: v.any(),
  })
    .index('by_owner', ['ownerId'])
    .index('by_game', ['gameId']),

  /**
   * The Change Log (ADR-022), promoted from a local-only audit trail to the
   * synchronized spine of the whole feature.
   *
   * It is simultaneously the audit trail, the sync log, and the alert bus: a
   * Mediator's proposal is simply an entry in `proposed` state that the player
   * commits by applying it. `supersededBy` implements D25 — a newer proposal
   * against the same (entityId, field) retires the older one, so a player never
   * faces two contradictory pending changes to one value. Nothing expires and
   * nothing is ever force-applied.
   */
  changeLog: defineTable({
    gameId: v.union(v.id('games'), v.null()),
    entityType: v.string(),
    entityId: v.string(),
    ts: v.number(),
    /** 'transaction' | 'override' | 'manual' (ADR-022). */
    kind: v.string(),
    field: v.string(),
    before: v.any(),
    after: v.any(),
    /** The surface that made the change, e.g. 'live-sheet', 'dashboard'. */
    source: v.string(),
    /** Who performed or proposed it. */
    actorId: v.union(v.id('users'), v.null()),
    /** 'applied' | 'proposed' | 'declined' | 'superseded'. */
    state: v.string(),
    supersededBy: v.optional(v.id('changeLog')),
  })
    .index('by_entity', ['entityId'])
    .index('by_game', ['gameId'])
    .index('by_game_state', ['gameId', 'state']),

  /**
   * Crew-wide Downtime state (ADR-030, Phase 5).
   *
   * Downtime is the one procedure the whole crew performs in step, so the phase
   * is **Game state advanced by the Mediator** rather than something each
   * player tracks alone. Per-player step completion lives here too, so the
   * table can see who is still working.
   *
   * One row per Game. `stepIndex: null` means Downtime is not running — which
   * is a state, not an absence, and is why this is not simply the row's absence.
   */
  downtime: defineTable({
    gameId: v.id('games'),
    /** Null when Downtime is not running. */
    stepIndex: v.union(v.number(), v.null()),
    startedAt: v.union(v.number(), v.null()),
    /**
     * Which members have marked the current step done. Cleared whenever the
     * phase advances — completion is per step, not cumulative, or a player who
     * finished step 1 would look finished forever.
     */
    completedBy: v.array(v.id('users')),
    /** Set once per Downtime so crawler upkeep is spent once, not per member. */
    upkeepSpent: v.boolean(),
  }).index('by_game', ['gameId']),

  /** Who is at the table right now. Ephemeral — never folded into an entity. */
  presence: defineTable({
    gameId: v.id('games'),
    userId: v.id('users'),
    lastSeen: v.number(),
  })
    .index('by_game', ['gameId'])
    .index('by_game_user', ['gameId', 'userId']),
})
