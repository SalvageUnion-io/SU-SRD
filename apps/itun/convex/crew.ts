import { v } from 'convex/values'
import type { MechStatus, PilotStatus } from '../src/lib/rules/crewStatus'
import {
  mechMaxima,
  mechNeedsAttention,
  mechStatus,
  pilotMaxima,
  pilotNeedsAttention,
  pilotStatus,
} from '../src/lib/rules/crewStatus'
import type { Mech } from '../src/lib/schemas/mech'
import { MechSchema } from '../src/lib/schemas/mech'
import type { Pilot } from '../src/lib/schemas/pilot'
import { PilotSchema } from '../src/lib/schemas/pilot'
import { query } from './_generated/server'
import { linkIdOf } from './model/entities'
import { requireMember, requireUser } from './model/permissions'
import { loadReferenceData } from './model/referenceData'
import { seatsInGame } from './model/seats'

/**
 * Crew visibility inside a Game (ADR-030 §5), and the crew's derived
 * status (ADR-038 §4).
 *
 * Every member sees every crewmate's **vitals** live: the Dashboard's Crew tab,
 * the Game hub's crew strip and the Mediator's proposal form all read this
 * query. Drill-in is the live sheet (`/sheet/$kind/$id`), read-only for a
 * crewmate's. What stays hidden is the Mediator's prepared opposition — that
 * is the one thing a player must not be able to read, and it is simply not
 * queried here.
 *
 * ## The server derives the numbers
 *
 * Max HP, AP, SP, EP and Heat, and each crewmate's status (dead, injured,
 * ejected; destroyed, shut down, overheating, destroyed systems and modules),
 * are computed here with the rules the client uses (`src/lib/rules/crewStatus.ts`
 * over `salvageunion-reference/rules`), from the stored records and the seats.
 * One answer for the whole table: the Crew tab's ▲ and red outlines read it,
 * so every client agrees on who needs looking at. Nothing derived is stored.
 * Convex loads the reference data the rules need itself
 * (`model/referenceData.ts`).
 *
 * ## Why vitals are a separate, narrow query
 *
 * The crew strip re-renders on every point of damage anyone takes. Serving it
 * from `entities.listForGame` would push every crewmate's full sheet — loadouts,
 * abilities, cargo — down the wire on each change, for a row that shows a few
 * numbers. A narrow projection keeps the hot path small and, just as usefully,
 * makes the privacy boundary legible: this query returns what a crewmate is
 * *entitled* to see at a glance, and nothing more. The loadouts are read to
 * derive the maxima and never leave.
 */

/** A pilot's derived numbers, or nulls when their body is not a readable pilot. */
type PilotDerived = {
  maxHP: number | null
  maxAP: number | null
  status: PilotStatus
  attention: boolean
}

/** A mech's derived numbers, or nulls when its body is not a readable mech. */
type MechDerived = {
  maxSP: number | null
  maxEP: number | null
  maxHeat: number | null
  status: MechStatus | null
  attention: boolean
}

/** Every crewmate's vitals, their derived maxima and status, and who the rows belong to. */
export const vitals = query({
  args: { gameId: v.id('games') },
  handler: async (ctx, args) => {
    await requireMember(ctx, args.gameId)
    const viewerId = await requireUser(ctx)

    const [pilots, mechs, crawlers, links, seats, members] = await Promise.all([
      ctx.db
        .query('pilots')
        .withIndex('by_game', (q) => q.eq('gameId', args.gameId))
        .collect(),
      ctx.db
        .query('mechs')
        .withIndex('by_game', (q) => q.eq('gameId', args.gameId))
        .collect(),
      ctx.db
        .query('crawlers')
        .withIndex('by_game', (q) => q.eq('gameId', args.gameId))
        .collect(),
      ctx.db
        .query('softLinks')
        .withIndex('by_game', (q) => q.eq('gameId', args.gameId))
        .collect(),
      seatsInGame(ctx, args.gameId),
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

    loadReferenceData()

    // Who crews which crawler, who is assigned which mech, and who is aboard
    // what: the links and seats the derivations need, all by app id.
    const crawlerTech = new Map<string, { techLevel: string }>()
    for (const c of crawlers) {
      const id = linkIdOf(c)
      const techLevel = (c.body as Record<string, unknown> | null)?.techLevel
      if (id !== undefined && typeof techLevel === 'string') crawlerTech.set(id, { techLevel })
    }
    const crawlerOfPilot = new Map<string, string>()
    const mechOfPilot = new Map<string, string>()
    const pilotOfMech = new Map<string, string>()
    for (const link of links) {
      if (link.type === 'pilot-to-crawler') crawlerOfPilot.set(link.from.id, link.to.id)
      if (link.type === 'mech-to-pilot') {
        mechOfPilot.set(link.to.id, link.from.id)
        pilotOfMech.set(link.from.id, link.to.id)
      }
    }
    const seatOf = new Map(seats.map((s) => [s.pilotId, s]))
    const boarderOf = new Map<string, string>()
    for (const s of seats) if (s.mount.kind === 'boarded') boarderOf.set(s.mount.mechId, s.pilotId)

    // Parsed once: a mech's maxima read the abilities of the pilot flying it.
    const parsedPilots = new Map<string, Pilot>()
    const pilotRows = pilots.map((row) => {
      const id = linkIdOf(row) ?? null
      const parsed = PilotSchema.safeParse(row.body)
      if (id !== null && parsed.success) parsedPilots.set(id, parsed.data)
      return { row, id, pilot: parsed.success ? parsed.data : null }
    })

    function derivePilot(id: string | null, pilot: Pilot | null): PilotDerived {
      const ejected = id === null ? false : seatOf.get(id)?.ejected === true
      if (pilot === null) {
        const status = { dead: false, injured: false, ejected }
        return { maxHP: null, maxAP: null, status, attention: pilotNeedsAttention(status) }
      }
      const crawlerId = id === null ? undefined : crawlerOfPilot.get(id)
      const crawler = crawlerId === undefined ? null : (crawlerTech.get(crawlerId) ?? null)
      const { maxHP, maxAP } = pilotMaxima(pilot, crawler)
      const status = pilotStatus(pilot, crawler, ejected)
      return { maxHP, maxAP, status, attention: pilotNeedsAttention(status) }
    }

    function deriveMech(id: string | null, body: unknown): MechDerived {
      const parsed = MechSchema.safeParse(body)
      if (!parsed.success) {
        return { maxSP: null, maxEP: null, maxHeat: null, status: null, attention: false }
      }
      const mech: Mech = parsed.data
      // The pilot aboard it, else the pilot assigned to it, as the Dashboard
      // reads its own mech: their abilities, and the effects their seat has on.
      const pilotId = id === null ? undefined : (boarderOf.get(id) ?? pilotOfMech.get(id))
      const piloting = pilotId === undefined ? undefined : parsedPilots.get(pilotId)
      const switchedOn = pilotId === undefined ? [] : (seatOf.get(pilotId)?.activeEffects ?? [])
      const { maxSP, maxEP, maxHeat } = mechMaxima(mech, piloting?.abilities, switchedOn)
      const status = mechStatus(mech, maxHeat)
      return { maxSP, maxEP, maxHeat, status, attention: mechNeedsAttention(status) }
    }

    return {
      viewerId,
      pilots: pilotRows.map(({ row: p, id, pilot }) => {
        const seat = id === null ? undefined : seatOf.get(id)
        const boarded = seat?.mount.kind === 'boarded' ? seat.mount.mechId : null
        return {
          _id: p._id,
          appId: p.appId ?? null,
          /**
           * The id links, seats and `/sheet/$kind/$id` use: the app id, or a
           * template pre-gen's body id (`linkIdOf`). Key on this, not `appId`,
           * which a Starter Set row never has.
           */
          linkId: id,
          ownerId: p.ownerId,
          ownerName: p.ownerId === null ? null : (names.get(p.ownerId) ?? null),
          name: ((p.body as Record<string, unknown> | null)?.callsign as string) ?? 'Pilot',
          currentHP: num(p.body, 'currentHP'),
          currentAP: num(p.body, 'currentAP'),
          /** True when their seat has them aboard `mechId`. */
          boarded: boarded !== null,
          /** The mech they are aboard, else the one assigned to them (`mech-to-pilot`). */
          mechId: boarded ?? (id === null ? null : (mechOfPilot.get(id) ?? null)),
          ...derivePilot(id, pilot),
        }
      }),
      mechs: mechs.map((m) => {
        const id = linkIdOf(m) ?? null
        return {
          _id: m._id,
          appId: m.appId ?? null,
          /** The id a pilot's `mechId` and the seats name it by (see the pilot's). */
          linkId: id,
          ownerId: m.ownerId,
          ownerName: m.ownerId === null ? null : (names.get(m.ownerId) ?? null),
          name: ((m.body as Record<string, unknown> | null)?.name as string) ?? 'Mech',
          currentSP: num(m.body, 'currentSP'),
          currentEP: num(m.body, 'currentEP'),
          currentHeat: num(m.body, 'currentHeat'),
          ...deriveMech(id, m.body),
        }
      }),
    }
  },
})
