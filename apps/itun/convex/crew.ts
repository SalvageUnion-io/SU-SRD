import { v } from 'convex/values'

import { query } from './_generated/server'
import { requireMember, requireUser } from './model/permissions'

/**
 * Crew visibility inside a Game (ADR-030 §5, D12).
 *
 * Every member sees every crewmate's **vitals** live, and can drill into a
 * crewmate's full sheet **read-only**. What stays hidden is the Mediator's
 * prepared opposition — that is the one thing a player must not be able to
 * read, and it is simply not queried here.
 *
 * ## Why vitals are a separate, narrow query
 *
 * The crew strip re-renders on every point of damage anyone takes. Serving it
 * from `entities.listForGame` would push every crewmate's full sheet — loadouts,
 * abilities, cargo — down the wire on each change, for a row that shows four
 * numbers. A narrow projection keeps the hot path small and, just as usefully,
 * makes the privacy boundary legible: this query returns what a crewmate is
 * *entitled* to see at a glance, and nothing more.
 */

/** The four numbers a crew strip shows, plus who the row belongs to. */
export const vitals = query({
  args: { gameId: v.id('games') },
  handler: async (ctx, args) => {
    await requireMember(ctx, args.gameId)
    const viewerId = await requireUser(ctx)

    const [pilots, mechs, members] = await Promise.all([
      ctx.db
        .query('pilots')
        .withIndex('by_game', (q) => q.eq('gameId', args.gameId))
        .collect(),
      ctx.db
        .query('mechs')
        .withIndex('by_game', (q) => q.eq('gameId', args.gameId))
        .collect(),
      ctx.db
        .query('memberships')
        .withIndex('by_game', (q) => q.eq('gameId', args.gameId))
        .collect(),
    ])

    const names = new Map<string, string>()
    for (const m of members) {
      const user = await ctx.db.get(m.userId)
      names.set(m.userId, user?.displayName ?? user?.name ?? 'Crewmate')
    }

    /**
     * Read a numeric field off an opaque body without trusting its shape.
     *
     * **The key must match the Zod schema exactly, including case.** These
     * originally read `currentHp` / `currentAp` / `currentSp` while
     * `src/lib/schemas/` defines `currentHP` / `currentAP` / `currentSP`, so
     * every pilot's HP and AP and every mech's SP came back null and the crew
     * strip rendered a full row of em-dashes — indistinguishable from "nobody
     * has taken damage yet", which is why it survived review. The body is
     * `v.any()` on this side of the wire, so nothing but this comment and the
     * test below will catch it next time.
     */
    const num = (body: unknown, key: string): number | null => {
      const value = (body as Record<string, unknown> | null)?.[key]
      return typeof value === 'number' ? value : null
    }

    return {
      viewerId,
      pilots: pilots.map((p) => ({
        _id: p._id,
        appId: p.appId ?? null,
        ownerId: p.ownerId,
        ownerName: p.ownerId === null ? null : (names.get(p.ownerId) ?? null),
        name: ((p.body as Record<string, unknown> | null)?.callsign as string) ?? 'Pilot',
        currentHP: num(p.body, 'currentHP'),
        currentAP: num(p.body, 'currentAP'),
      })),
      mechs: mechs.map((m) => ({
        _id: m._id,
        appId: m.appId ?? null,
        ownerId: m.ownerId,
        ownerName: m.ownerId === null ? null : (names.get(m.ownerId) ?? null),
        name: ((m.body as Record<string, unknown> | null)?.name as string) ?? 'Mech',
        currentSP: num(m.body, 'currentSP'),
        currentHeat: num(m.body, 'currentHeat'),
      })),
    }
  },
})

/**
 * A crewmate's full sheet, read-only.
 *
 * Membership is the whole check — inside a Game you may read any crewmate's
 * pilot or mech, which is what "lean over and look at their sheet" means at a
 * physical table. There is no write counterpart to this query anywhere; a
 * Mediator who wants to change what they are reading proposes instead (D7).
 */
export const readEntity = query({
  args: {
    table: v.union(v.literal('pilots'), v.literal('mechs')),
    entityId: v.string(),
  },
  handler: async (ctx, args) => {
    const doc = await ctx.db.get(args.entityId as never)
    if (doc === null) return null

    const row = doc as unknown as { gameId: string | null; ownerId: string | null; body: unknown }
    // A shelved entity has no Game to be a member of; it is private to its
    // owner, and this query is deliberately not the way to reach one.
    if (row.gameId === null) return null

    await requireMember(ctx, row.gameId as never)
    return { ownerId: row.ownerId, body: row.body }
  },
})
