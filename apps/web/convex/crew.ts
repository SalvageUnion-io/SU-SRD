import { v } from 'convex/values'
import type { MechDerived, PilotDerived, SheetVitals } from 'game-domain/botWire'
import type { MechStatus, PilotStatus } from 'game-domain/rules/crewStatus'
import type { CrewUnit } from 'game-domain/rules/crewVitals'
import { crewDeriver } from 'game-domain/rules/crewVitals'
import type { Doc } from './_generated/dataModel'
import type { QueryCtx } from './_generated/server'
import { query } from './_generated/server'
import { displayNameOf } from './account'
import { linkIdOf } from './model/entities'
import { entityNameOf } from './model/entityName'
import { membershipOrNull, requireUser } from './model/permissions'
import { loadReferenceData } from './model/referenceData'
import { seatsInGame } from './model/seats'
import { mirrors } from './model/validators'

/**
 * Crew visibility inside a Game (ADR-030 §5), and the crew's derived
 * status (ADR-038 §4).
 *
 * Every member sees every crewmate's **vitals** live: Play's Crew,
 * the Game hub's crew strip and the Mediator's proposal form all read this
 * query. Drill-in is the live sheet (`/<kind>s/$id`, `sheetPath`), read-only for a
 * crewmate's. What stays hidden is the Mediator's prepared opposition — that
 * is the one thing a player must not be able to read, and it is simply not
 * queried here.
 *
 * ## The server derives the numbers
 *
 * Max HP, AP, SP, EP and Heat, and each crewmate's status (dead, injured,
 * ejected; destroyed, shut down, overheating, destroyed systems and modules),
 * are computed here with the rules the client uses (`game-domain/rules/crewStatus`
 * over `salvageunion-reference/rules`), from the stored records and the seats.
 * One answer for the whole table: the Crew tab's ▲ and red outlines read it,
 * so every client agrees on who needs looking at. Nothing derived is stored.
 * Convex loads the reference data the rules need itself
 * (`model/referenceData.ts`). The derivation is `crewDeriver`
 * (`game-domain/rules/crewVitals`), which the rooms derive the bot's
 * `/su sheet` with too, so the bot, the Game hub and Play agree on a
 * crewmate's numbers.
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

const nullableNumber = v.union(v.number(), v.null())
const nullableString = v.union(v.string(), v.null())

/** `PilotStatus` (game-domain/rules/crewStatus). */
const pilotStatusValidator = mirrors<PilotStatus>()(
  v.object({ dead: v.boolean(), injured: v.boolean(), ejected: v.boolean() })
)

/** `MechStatus` (game-domain/rules/crewStatus). */
const mechStatusValidator = mirrors<MechStatus>()(
  v.object({
    destroyed: v.boolean(),
    shutdown: v.boolean(),
    overheating: v.boolean(),
    destroyedSystems: v.array(v.string()),
    destroyedModules: v.array(v.string()),
  })
)

/** A pilot's derived numbers: `PilotDerived`, the shape the bot reads too. */
export const pilotDerived = mirrors<PilotDerived>()(
  v.object({
    maxHP: nullableNumber,
    maxAP: nullableNumber,
    status: pilotStatusValidator,
    attention: v.boolean(),
  })
)

/** A mech's derived numbers: `MechDerived`, the shape the bot reads too. */
export const mechDerived = mirrors<MechDerived>()(
  v.object({
    maxSP: nullableNumber,
    maxEP: nullableNumber,
    maxHeat: nullableNumber,
    status: v.union(mechStatusValidator, v.null()),
    attention: v.boolean(),
  })
)

/** A row as the derivation reads it: its link id (`linkIdOf`) and its body. */
function crewUnit(row: Doc<'pilots'> | Doc<'mechs'> | Doc<'crawlers'>): CrewUnit {
  return { id: linkIdOf(row), body: row.body }
}

/** `crewDeriver` over one container's rows, with the reference data it reads. */
function deriverOver(records: {
  pilots: Doc<'pilots'>[]
  crawlers: Doc<'crawlers'>[]
  links: Doc<'softLinks'>[]
  seats: Doc<'seats'>[]
}) {
  loadReferenceData()
  return crewDeriver({
    pilots: records.pilots.map(crewUnit),
    crawlers: records.crawlers.map(crewUnit),
    links: records.links,
    seats: records.seats,
  })
}

/** A sheet's row, tagged with the table it was read from. */
export type SheetRow =
  | { table: 'pilots'; row: Doc<'pilots'> }
  | { table: 'mechs'; row: Doc<'mechs'> }
  | { table: 'crawlers'; row: Doc<'crawlers'> }

/**
 * One sheet's derived vitals, as `crew.vitals` would derive them in its Game —
 * or, for a shelved sheet, over its owner's shelf — and null for a crawler.
 *
 * Reads only the container the row is in: its pilots and crawlers, the links
 * leaving the row (its `pilot-to-crawler`, or a mech's `mech-to-pilot`), and
 * the Game's seats. A shelf has no seats.
 */
export async function sheetVitals(ctx: QueryCtx, sheet: SheetRow): Promise<SheetVitals | null> {
  if (sheet.table === 'crawlers') return null
  const { gameId, ownerId } = sheet.row
  const id = linkIdOf(sheet.row)

  // A shelf row with no owner shares a container with nothing (ADR-030 §2).
  const shelfOwner = gameId === null ? ownerId : null
  const containerRows = async (table: 'pilots' | 'crawlers') => {
    if (gameId !== null) {
      return await ctx.db
        .query(table)
        .withIndex('by_game', (q) => q.eq('gameId', gameId))
        .collect()
    }
    if (shelfOwner === null) return []
    return await ctx.db
      .query(table)
      .withIndex('by_owner_game', (q) => q.eq('ownerId', shelfOwner).eq('gameId', null))
      .collect()
  }

  const [pilots, crawlers, links, seats] = await Promise.all([
    containerRows('pilots') as Promise<Doc<'pilots'>[]>,
    containerRows('crawlers') as Promise<Doc<'crawlers'>[]>,
    id === undefined
      ? []
      : ctx.db
          .query('softLinks')
          .withIndex('by_from', (q) => q.eq('from.id', id))
          .collect(),
    gameId === null ? [] : seatsInGame(ctx, gameId),
  ])

  const derive = deriverOver({
    pilots,
    crawlers,
    // A link is drawn inside one container, as the row is.
    links: links.filter((link) => link.gameId === gameId),
    seats,
  })
  return sheet.table === 'pilots'
    ? { kind: 'pilot', ...derive.derivePilot(crewUnit(sheet.row)) }
    : { kind: 'mech', ...derive.deriveMech(crewUnit(sheet.row)) }
}

/** One crewmate's row: who it is, whose it is, and what it reads at a glance. */
const crewRow = {
  appId: nullableString,
  linkId: nullableString,
  ownerId: v.union(v.id('users'), v.null()),
  ownerName: nullableString,
  name: v.string(),
}

/** Every crewmate's vitals, their derived maxima and status, and who the rows belong to. */
export const vitals = query({
  args: { gameId: v.id('games') },
  returns: v.object({
    viewerId: v.id('users'),
    pilots: v.array(
      v.object({
        _id: v.id('pilots'),
        ...crewRow,
        currentHP: nullableNumber,
        currentAP: nullableNumber,
        boarded: v.boolean(),
        mechId: nullableString,
        ...pilotDerived.fields,
      })
    ),
    mechs: v.array(
      v.object({
        _id: v.id('mechs'),
        ...crewRow,
        currentSP: nullableNumber,
        currentEP: nullableNumber,
        currentHeat: nullableNumber,
        ...mechDerived.fields,
      })
    ),
  }),
  handler: async (ctx, args) => {
    const membership = await membershipOrNull(ctx, args.gameId)
    if (membership === null) return { viewerId: await requireUser(ctx), pilots: [], mechs: [] }
    const viewerId = membership.userId

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
      names.set(m.userId, displayNameOf(user, 'Crewmate'))
    }

    /**
     * Read a numeric field off an opaque body without trusting its shape.
     *
     * **Keys must match the Zod schema exactly, including case**
     * (`currentHP` / `currentAP` / `currentSP`). A mismatch reads as null,
     * which renders the same as "undamaged". The body is `v.any()`, so only
     * the test below catches it.
     */
    const num = (body: unknown, key: string): number | null => {
      const value = (body as Record<string, unknown> | null)?.[key]
      return typeof value === 'number' ? value : null
    }

    const { seatOf, mechOfPilot, derivePilot, deriveMech } = deriverOver({
      pilots,
      crawlers,
      links,
      seats,
    })

    return {
      viewerId,
      pilots: pilots.map((p) => {
        const id = linkIdOf(p) ?? null
        const seat = id === null ? undefined : seatOf.get(id)
        const boarded = seat?.mount.kind === 'boarded' ? seat.mount.mechId : null
        return {
          _id: p._id,
          appId: p.appId ?? null,
          /**
           * The id links, seats and the sheet routes use: the app id, or a
           * template pre-gen's body id (`linkIdOf`). Key on this, not `appId`,
           * which a Starter Set row never has.
           */
          linkId: id,
          ownerId: p.ownerId,
          ownerName: p.ownerId === null ? null : (names.get(p.ownerId) ?? null),
          name: entityNameOf('pilot', p.body) ?? 'Pilot',
          currentHP: num(p.body, 'currentHP'),
          currentAP: num(p.body, 'currentAP'),
          /** True when their seat has them aboard `mechId`. */
          boarded: boarded !== null,
          /** The mech they are aboard, else the one assigned to them (`mech-to-pilot`). */
          mechId: boarded ?? (id === null ? null : (mechOfPilot.get(id) ?? null)),
          ...derivePilot(crewUnit(p)),
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
          name: entityNameOf('mech', m.body) ?? 'Mech',
          currentSP: num(m.body, 'currentSP'),
          currentEP: num(m.body, 'currentEP'),
          currentHeat: num(m.body, 'currentHeat'),
          ...deriveMech(crewUnit(m)),
        }
      }),
    }
  },
})
