import { v } from 'convex/values'
import { containerOf, SHELF, sameContainer } from '../src/lib/container'
import type { EntityRef } from '../src/lib/schemas/entity'
import { EntityRefSchema } from '../src/lib/schemas/entity'
import type { SoftLink } from '../src/lib/schemas/softLink'
import { SoftLinkSchema } from '../src/lib/schemas/softLink'
import type { MutationCtx } from './_generated/server'
import { bodyAppId, findSoftLink, mutation, PARSERS } from './model/entities'
import { requireUser } from './model/permissions'

/**
 * Bringing a device's roster into an account (ADR-034 / ADR-035).
 *
 * Two mutations, both run by the client's one local → account reconciler
 * (`AccountReconciler`, over `src/lib/account/reconcile.ts`), and nothing else:
 *
 *  - `claimLocal` uploads what a browser holds and the account does not —
 *    onto the **shelf**, never into a Game, and idempotently, because it runs
 *    on every signed-in load rather than once per account.
 *  - `repairContainers` makes every owned body agree with the row it is filed
 *    in, which reaches the rows an earlier claim already landed.
 *
 * Split out of `entities.ts` (audit AP-07). The claim is a migration path with
 * its own identity rules and its own failure modes — declining a crewmate's
 * cached build, tolerating a table that is already duplicated — and none of
 * that belongs beside the per-write mirror API the app uses every second.
 */

/*
 * Soft-link kind guards, asked of the Zod schemas rather than of a copied list,
 * so the Convex unions in `schema.ts` and the local schemas cannot drift apart
 * without one of these failing.
 */

/** Whether `value` is an endpoint kind `EntityRefSchema` allows. */
function isEntityRefType(value: unknown): value is EntityRef['type'] {
  return EntityRefSchema.shape.type.safeParse(value).success
}

/** Whether `value` is a relationship kind `SoftLinkSchema` allows. */
function isSoftLinkType(value: unknown): value is SoftLink['type'] {
  return SoftLinkSchema.shape.type.safeParse(value).success
}

/**
 * Whether this table already holds a row carrying this app id.
 *
 * Deliberately `.first()` and not `.unique()`, which is the opposite of
 * `byAppId` in `entities.ts`, and the difference is the point: this
 * function's job is to run correctly **on a table that is already duplicated**.
 * `.unique()` throws when it finds more than one row, so using it here would
 * make the claim that repairs nothing also fail outright on exactly the accounts
 * that need repairing most.
 *
 * Existence is asked without reference to who owns the row. A row with this app
 * id belonging to somebody else is still a reason not to insert: `byAppId` is a
 * **global** lookup, so a second row would break the mirror for both accounts
 * rather than one. See the note on app-id collisions in `claimLocal`.
 */
async function appIdTaken(
  ctx: MutationCtx,
  table: 'pilots' | 'mechs' | 'crawlers',
  appId: string
): Promise<boolean> {
  const existing = await ctx.db
    .query(table)
    .withIndex('by_app_id', (q) => q.eq('appId', appId))
    .first()
  return existing !== null
}

/** The three tables whose body carries a container the client reads. */
const CONTAINED = {
  pilots: PARSERS.pilots,
  mechs: PARSERS.mechs,
  crawlers: PARSERS.crawlers,
} as const

/**
 * Make every owned body agree with the row it is stored in
 * ([ADR-035](../../../docs/adrs/ADR-035-no-isolated-local-only-data.md)
 * decision 3).
 *
 * ## The rows `claimLocal` cannot reach
 *
 * `shelveBody` fixes this on the way in, and `legacyMigration` sends anything
 * the account does not hold. Neither touches a build that was **already
 * claimed** under the old card: the account owns it, so it is not stranded and
 * nothing re-sends it — while its body still names a Workspace that migration
 * v13 turned into a `gameId` and that has never been a Game. Signed out nothing
 * filters and it renders; signed in, `Roster` scopes to the active container
 * and it is gone. Owned, server-backed, and invisible.
 *
 * That population is unreachable from the client's side of the migration, which
 * is why the repair is a mutation over the account rather than a pass over one
 * browser's IndexedDB. It also fixes rows this device has never held — a build
 * claimed from a phone, opened on a laptop.
 *
 * ## The column is the authority, not membership
 *
 * The rule is `body.gameId := row.gameId`, and it is deliberately not "shelve
 * anything whose Game I am not a member of". The column is what the server
 * enforces ownership and container against; the body is a client record that
 * drifted from it. Repairing toward the column needs no membership lookup, is
 * right for a Game row as well as a shelf row, and cannot move an entity
 * somewhere it was not already filed.
 *
 * Compared through `containerOf` rather than on the raw field, because a
 * pre-ADR-030 body carries no `gameId` at all and resolves through
 * `workspaceId` — that record reads as being in a phantom Game too, and a raw
 * `body.gameId ?? null` check would call it identical to a shelf row and skip
 * it. Idempotent either way: after the patch the two resolve the same, so a
 * second run writes nothing.
 */
export const repairContainers = mutation({
  args: {},
  handler: async (
    ctx
  ): Promise<{ repaired: number; skipped: number; byKind: Record<string, number> }> => {
    const userId = await requireUser(ctx)
    let repaired = 0
    let skipped = 0
    const byKind: Record<string, number> = {}

    for (const table of ['pilots', 'mechs', 'crawlers'] as const) {
      const rows = await ctx.db
        .query(table)
        .withIndex('by_owner_game', (q) => q.eq('ownerId', userId))
        .collect()

      for (const row of rows) {
        const body = row.body as Record<string, unknown> | null
        if (typeof body !== 'object' || body === null) {
          skipped += 1
          continue
        }

        const declared = row.gameId === null ? SHELF : { kind: 'game' as const, gameId: row.gameId }
        if (sameContainer(containerOf(body), declared)) continue

        const parsed = CONTAINED[table].safeParse({ ...body, gameId: row.gameId ?? null })
        if (!parsed.success) {
          // A body this build cannot re-parse is left exactly as it is. It is
          // still readable, still owned, and still exportable; refusing to
          // rewrite it is strictly safer than writing a shape the schema
          // rejects, and the count comes back so the caller can say so.
          skipped += 1
          continue
        }

        await ctx.db.patch(row._id, { body: parsed.data, updatedAt: Date.now() })
        repaired += 1
        byKind[table] = (byKind[table] ?? 0) + 1
      }
    }

    return { repaired, skipped, byKind }
  },
})

/**
 * Does this body name a Game that genuinely exists?
 *
 * The claim cannot trust the client's judgement here, and the client cannot
 * form one. A local row filed under a Game the caller is not a member of is
 * ambiguous two ways, and the two need opposite handling:
 *
 *  - a **phantom** container — a Workspace id that migration v13 wrote as a
 *    `gameId`, naming a Game that has never existed. This is somebody's own
 *    pre-account build and it must be migrated.
 *  - a Game the caller **left**, was removed from, or that was destroyed.
 *    `GameRoster.ensureLocal` adopts crewmates' pilots and the communal crawler
 *    into IndexedDB on open, and `rowMayBePruned` never prunes a Game row, so
 *    those copies outlive the membership. Migrating one would shelve **another
 *    player's character into the caller's account** — and for an unclaimed
 *    pre-gen, which carries no `appId` for `appIdTaken` to catch, it would
 *    actually insert it.
 *
 * Only the server can tell them apart, and it can do so without disclosing
 * anything: the answer never leaves this mutation, which returns aggregate
 * counts. That is the same reason `games.get` returns `null` rather than
 * throwing for a non-member — a non-member must not be able to distinguish an
 * existing Game from a deleted one, and nothing here lets them.
 *
 * `normalizeId` rather than a bare `db.get`, because a Workspace UUID is not a
 * well-formed Convex id and `get` would throw on it — which is precisely the
 * case that must resolve to "no such Game".
 */
async function namesALiveGame(ctx: MutationCtx, body: unknown): Promise<boolean> {
  if (typeof body !== 'object' || body === null) return false
  const container = containerOf(body as { gameId?: string | null; workspaceId?: string })
  if (container.kind !== 'game') return false
  const gameId = ctx.db.normalizeId('games', container.gameId)
  if (gameId === null) return false
  return (await ctx.db.get(gameId)) !== null
}

/**
 * Rewrite a claimed body so its container agrees with the row it lands in.
 *
 * Everything claimed lands on the **shelf** — `gameId: null` in the column — but
 * the body is the client's own record and carries its own `gameId`, which the
 * client is what actually reads (`lib/container.ts`). Leaving the two to
 * disagree is not cosmetic: migration v13 mapped every pre-ADR-030 Workspace
 * onto `gameId: <that workspace id>`, so a claimed body routinely names a Game
 * that does not exist. Signed out nothing filters and the pile renders whole;
 * signed in, `Roster` scopes to the active container and every such build
 * vanishes — claimed, owned, paid for, and invisible.
 *
 * `null` explicitly rather than deleting the key: `containerOf` reads `null` as
 * "shelved, decided" and `undefined` as "predates the split, fall back to
 * `workspaceId`", and the fallback is where the phantom Game came from.
 */
function shelveBody<T>(body: T): T {
  if (typeof body !== 'object' || body === null) return body
  return { ...body, gameId: null }
}

/**
 * Upload local entities into this account on first sign-in (D11).
 *
 * Everything lands on the **shelf**, never straight into a Game. A person
 * signing in for the first time has local builds with no relationship to any
 * crew, and guessing one would be worse than making them place it deliberately.
 *
 * Bodies are Zod-parsed like any other write, and a row that fails is **skipped
 * rather than aborting the claim**. A single corrupt local record should not
 * cost somebody their whole roster — the count of skipped rows comes back so
 * the UI can say what did not make it.
 *
 * ## Claiming twice is now a no-op, and it has to be
 *
 * Every insert below is guarded on identity, because this mutation is **not**
 * called once per account no matter how the UI is written. The only thing that
 * used to stop a second run was a `localStorage` marker on one device, and the
 * card that writes it is deliberately re-offered on a second device — so a
 * player signing in on their laptop after their phone, or in a fresh browser
 * profile, or after clearing site data, ran the whole claim again.
 *
 * The consequence was not a cosmetic double-up. Pilots, mechs and crawlers are
 * addressed by `appId`, and the lookups that address them (`byAppId`,
 * `patchCrawlerByAppId`) use `.unique()`, which **throws** on a second row.
 * From the moment a roster was claimed twice, every mirrored write for those
 * entities failed with an opaque server error, silently and permanently: the
 * local write still succeeded, so the app looked fine while IndexedDB and the
 * declared server of record drifted apart for good. That is the failure this
 * guard exists to make impossible, and a client-side marker was never the right
 * place to enforce it — the damage is server-side and forever, so the check
 * belongs here.
 *
 * Identity per kind: `appId` for pilots, mechs and crawlers; the
 * (from, to, kind) triple for soft links; the body's own id for patterns.
 *
 * ## The residual sharp edge: app ids are not globally unique
 *
 * `appId` is a UUID the client minted, and export/import copies a build between
 * people **keeping its id**. Two accounts can therefore legitimately hold the
 * same app id, which the `by_app_id` + `.unique()` pairing assumes cannot
 * happen. This mutation takes the safe side of that — an app id already present
 * anywhere is reported as `alreadyPresent` rather than inserted, so a claim can
 * decline to copy a build instead of corrupting the mirror for two people. That
 * is a real limitation, not a fix; closing it means keying the index on
 * (ownerId, appId), which is a schema change and its own piece of work.
 */
export const claimLocal = mutation({
  args: {
    pilots: v.array(v.any()),
    mechs: v.array(v.any()),
    crawlers: v.optional(v.array(v.any())),
    softLinks: v.optional(v.array(v.any())),
    mechPatterns: v.optional(v.array(v.any())),
    /**
     * The player's own NPC tray.
     *
     * Newly claimable, and only because P0 gave `encounterNpcs` the two
     * container columns: before that an NPC could exist only inside a Game, so
     * there was nowhere for a claimed one to land and it was silently dropped —
     * the same gap the crawler had before #871.
     */
    encounterNpcs: v.optional(v.array(v.any())),
  },
  handler: async (
    ctx,
    args
  ): Promise<{
    claimed: number
    skipped: number
    alreadyPresent: number
    /**
     * Rows refused because they belong to a Game that exists — a crewmate's
     * build this browser cached and kept after leaving. Reported separately
     * from `skipped` and `alreadyPresent` on purpose: those two mean "still
     * only on the device", and a caller uses them to decide whether the
     * migration is finished. A declined row is not the caller's to migrate at
     * all, so counting it with them would leave the migration permanently
     * unfinished over rows that are already safe on the server.
     */
    declined: number
    /**
     * The app ids of the rows counted in `skipped` or `alreadyPresent` — the
     * rows that did NOT land, named so a caller can tell them apart from the
     * ones that did.
     *
     * The counts alone cannot do that, and a caller that needs to record what
     * a PARTIAL pass saved was left with two wrong choices: record nothing
     * (the landed rows stay "unsaved", are resent on retry and come back
     * `alreadyPresent` forever, and after a sign-out go to the NEXT account
     * too) or record everything (the refused rows are wrongly marked saved).
     *
     * Additive: the counts are unchanged. A refused row with no string `id`
     * cannot be named, so it is simply absent here — which is why a caller
     * must treat any row whose id is not in the set AND that it cannot
     * identify as not saved, rather than reading absence as success. The
     * client's `withoutIds` already does, because it never excludes an
     * id-less row.
     */
    strandedIds: string[]
    byKind: Record<string, number>
  }> => {
    const userId = await requireUser(ctx)
    const now = Date.now()
    let claimed = 0
    let skipped = 0
    let alreadyPresent = 0
    let declined = 0
    const strandedIds: string[] = []
    const byKind: Record<string, number> = {}

    /** Record a row that did not land, by the same id rule the client uses. */
    const strand = (body: unknown) => {
      const id = (body as { id?: unknown } | null)?.id
      if (typeof id === 'string') strandedIds.push(id)
    }
    const skip = (body: unknown) => {
      skipped += 1
      strand(body)
    }
    const present = (body: unknown) => {
      alreadyPresent += 1
      strand(body)
    }

    const bump = (kind: string) => {
      byKind[kind] = (byKind[kind] ?? 0) + 1
      claimed += 1
    }

    for (const [table, rows] of [
      ['pilots', args.pilots],
      ['mechs', args.mechs],
    ] as const) {
      for (const body of rows) {
        const parsed = PARSERS[table].safeParse(body)
        if (!parsed.success) {
          skip(body)
          continue
        }
        if (await namesALiveGame(ctx, body)) {
          declined += 1
          continue
        }

        const appId =
          typeof (body as { id?: unknown }).id === 'string'
            ? (body as { id: string }).id
            : undefined

        if (appId !== undefined && (await appIdTaken(ctx, table, appId))) {
          present(body)
          continue
        }

        await ctx.db.insert(table, {
          gameId: null,
          ownerId: userId,
          appId,
          body: shelveBody(parsed.data),
          updatedAt: now,
        })
        bump(table)
      }
    }

    /**
     * Crawlers, soft links and patterns are claimed too.
     *
     * The first version of this mutation took only pilots and mechs, which
     * silently dropped the crawler — the crew's HOME — along with every
     * pilot-to-crawler and mech-to-pilot link that makes a roster a roster, and
     * every saved pattern. Somebody claiming a long-running solo campaign would
     * have watched half of it vanish with no error.
     *
     * ## This used to invent a container, and no longer needs to
     *
     * A claimed crawler had no Game to go in and no shelf able to hold it, so
     * it was parked on a placeholder **"Claimed crawler" Game of one** — an
     * entire Game, plus a membership in it, raised solely to satisfy a
     * non-nullable `gameId`. That is gone: `crawlers` now carries the same two
     * container columns as `pilots` and `mechs`, so a claimed crawler lands
     * exactly where a claimed pilot lands, on the claimer's shelf.
     *
     * Two problems go with it. The placeholder appeared in the player's games
     * list as a table they never made and could not meaningfully use; and the
     * ordering dance that raised it lazily — resolving what to write BEFORE
     * inserting the Game, so that a re-claim with nothing new to say did not
     * leave an empty one behind — was load-bearing machinery guarding a
     * workaround. With no Game to raise there is nothing left to order, so the
     * crawler pass is now the same straight loop the pilots and mechs use.
     */
    for (const body of args.crawlers ?? []) {
      const parsed = PARSERS.crawlers.safeParse(body)
      if (!parsed.success) {
        skip(body)
        continue
      }
      if (await namesALiveGame(ctx, body)) {
        declined += 1
        continue
      }
      const appId =
        typeof (body as { id?: unknown }).id === 'string' ? (body as { id: string }).id : undefined
      if (appId !== undefined && (await appIdTaken(ctx, 'crawlers', appId))) {
        present(body)
        continue
      }
      await ctx.db.insert('crawlers', {
        gameId: null,
        ownerId: userId,
        appId,
        body: shelveBody(parsed.data),
        updatedAt: now,
      })
      bump('crawlers')
    }

    /**
     * The NPC tray claims onto the shelf, like everything else here.
     *
     * `ownerId: userId` with `gameId: null` — a tray on a shelf is owned, while
     * a tray in a Game is the Mediator's and owned by nobody. Claiming produces
     * the first of those, always: a claim has no Game to put anything in.
     */
    /*
     * The tray was the one claimed kind with NO repeat guard at all.
     *
     * That was survivable while claiming was a card somebody pressed once. It is
     * not survivable now that the migration runs by itself on every signed-in
     * load (ADR-035): an unguarded insert would grow the tray by its own size
     * every time. Identity is the id inside the body (which `appId` now carries
     * as a column) — the same rule the patterns pass below uses, and for the
     * same reason.
     */
    const ownNpcs =
      (args.encounterNpcs ?? []).length > 0
        ? await ctx.db
            .query('encounterNpcs')
            .withIndex('by_owner_app_id', (q) => q.eq('ownerId', userId))
            .collect()
        : []
    const ownNpcIds = new Set(
      ownNpcs
        .map((row) => (row.body as { id?: unknown }).id)
        .filter((id): id is string => typeof id === 'string')
    )

    for (const body of args.encounterNpcs ?? []) {
      // `PARSERS.encounterNpcs` rather than the schema directly — that map is
      // the single list of tables owing an edge parse, and reaching around it is
      // how a table ends up validated two different ways.
      const parsed = PARSERS.encounterNpcs.safeParse(body)
      if (!parsed.success) {
        skip(body)
        continue
      }
      const npcId = (body as { id?: unknown }).id
      if (typeof npcId === 'string' && ownNpcIds.has(npcId)) {
        present(body)
        continue
      }
      if (typeof npcId === 'string') ownNpcIds.add(npcId)

      await ctx.db.insert('encounterNpcs', {
        gameId: null,
        ownerId: userId,
        appId: bodyAppId(body),
        body: shelveBody(parsed.data),
      })
      bump('encounterNpcs')
    }

    for (const link of args.softLinks ?? []) {
      const l = link as {
        from?: { type?: string; id?: string }
        to?: { type?: string; id?: string }
        type?: string
      }
      /*
       * Endpoint kinds and the link kind are checked here rather than coerced.
       * They used to be waved through — `String(l.from.type ?? '')` wrote an
       * empty string for a link with no endpoint kind — and the schema, which
       * now declares both as closed unions, would refuse that write outright.
       * A link this claim cannot honour takes the same `skipped` path a
       * malformed one already did: the rest of the payload still lands.
       */
      if (
        typeof l.from?.id !== 'string' ||
        typeof l.to?.id !== 'string' ||
        !isEntityRefType(l.from.type) ||
        !isEntityRefType(l.to.type) ||
        !isSoftLinkType(l.type)
      ) {
        skip(link)
        continue
      }
      /*
       * A soft link has no `appId` of its own — it IS its endpoints — so
       * identity is the (from, to, kind) triple, and that is what a re-claim
       * has to match on. Duplicates here are less destructive than a duplicate
       * entity but they are not harmless: `listForGame` returns every row, so a
       * roster would draw the same mech-to-pilot link twice.
       *
       * Shares `findSoftLink` (`model/entities.ts`) with the mirror mutations
       * in `entities.ts` rather than repeating the lookup inline — the triple is
       * the link's identity in both places, and two copies of that rule could
       * disagree.
       */
      // Bound into locals: the checks above narrowed `l.from`/`l.to`, but that
      // narrowing does not survive the `await` below.
      const from = { type: l.from.type, id: l.from.id }
      const to = { type: l.to.type, id: l.to.id }
      const linkType = l.type

      if ((await findSoftLink(ctx, from.id, to.id, linkType)) !== null) {
        present(link)
        continue
      }

      // `gameId: null` — the shelf, matching the entities these link. It used to
      // be the placeholder Game's id whenever a crawler happened to be claimed in
      // the same call, which filed a shelf roster's wiring under a Game the player
      // never made.
      await ctx.db.insert('softLinks', { gameId: null, from, to, type: linkType })
      bump('softLinks')
    }

    /*
     * A pattern's identity is the id inside its body, so the repeat-claim check
     * compares against this user's own patterns. One indexed read of a set that
     * is per-person and small — a pattern is a saved mech loadout, not a log —
     * and cheaper than a lookup per claimed pattern. Rows written before the
     * `appId` column still carry their id in the body, which is why this reads
     * bodies rather than the column.
     */
    const ownPatterns =
      (args.mechPatterns ?? []).length > 0
        ? await ctx.db
            .query('mechPatterns')
            .withIndex('by_owner_app_id', (q) => q.eq('ownerId', userId))
            .collect()
        : []
    const ownPatternIds = new Set(
      ownPatterns
        .map((row) => (row.body as { id?: unknown }).id)
        .filter((id): id is string => typeof id === 'string')
    )

    for (const body of args.mechPatterns ?? []) {
      // Patterns are parsed like every other claimed body. They were the one
      // kind that went in unread, which made `mechPatterns.body` the only
      // `v.any()` column in the schema nothing ever validated.
      const parsed = PARSERS.mechPatterns.safeParse(body)
      if (!parsed.success) {
        skip(body)
        continue
      }
      const patternId = (body as { id?: unknown }).id
      if (typeof patternId === 'string' && ownPatternIds.has(patternId)) {
        present(body)
        continue
      }
      if (typeof patternId === 'string') ownPatternIds.add(patternId)

      await ctx.db.insert('mechPatterns', {
        ownerId: userId,
        gameId: null,
        appId: bodyAppId(body),
        body: parsed.data,
      })
      bump('mechPatterns')
    }

    return { claimed, skipped, alreadyPresent, declined, strandedIds, byKind }
  },
})
