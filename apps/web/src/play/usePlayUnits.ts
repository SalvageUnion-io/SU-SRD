/**
 * usePlayUnits — what the Units column shows (play.md §4): the pilot, the
 * mech (the one the seat is boarded in, else the pilot's assigned mech, else
 * the first of their own), the pilot's crawler, the rest of their mechs for
 * the hangar, and which of these are live (`unitLiveness`).
 *
 * The store holds what this browser may write. In a Game the crawler is the
 * Mediator's, and a mech may be a crewmate's, so neither need be in the
 * store: the Game's listing (`entities.listForGame`, the subscription the
 * Board menu already holds) shows them, read-only. A unit only the listing
 * carries is never live.
 */

import { useQuery } from 'convex/react'
import type { Crawler } from 'game-domain/schemas/crawler'
import type { Mech } from 'game-domain/schemas/mech'
import { resolveChassisRef } from 'salvageunion-reference/rules'
import { api } from '../../convex/_generated/api'
import type { Id } from '../../convex/_generated/dataModel'
import { readReference } from '../lib/readReference'
import { parseFrozenEntity } from '../lib/schemas/frozenEntity'
import { isSignedIn } from '../replica/sync'
import { useSync } from '../replica/syncContext'
import { useUnits } from '../replica/units'
import type { BoardOption } from './boardMenu.model'
import { boardable } from './boardMenu.model'
import type { MechPlace } from './PlayUnits'
import type { Play } from './situation.model'
import type { MechRestore, UnitLiveness } from './units.model'
import { hangarMechs, mechRestorePreview, unitLiveness } from './units.model'

/** A row of the Game's listing, as far as this reads it. */
type ListedRow = { appId: string | null; body: unknown }
type ListedLink = { type: string; from: { id: string }; to: { id: string } }

/** One mech in the hangar: its name, its chassis and why it cannot fly, if it cannot. */
type HangarMech = {
  mechId: string
  name: string
  chassis: string | null
  note: string | null
}

export type PlayUnits = {
  /** The mech the column shows, and where it is; null when the pilot has none. */
  mech: { mech: Mech; place: MechPlace; restore: MechRestore; held: boolean } | null
  /** The pilot's crawler, and whether the store holds it (may write it). */
  crawler: { crawler: Crawler; held: boolean } | null
  hangar: HangarMech[]
  live: UnitLiveness
  /** Board the shown mech: null when it cannot be boarded from here (not yours, offline). */
  board: (() => void) | null
}

/** The body filed under `id` in a listing's rows, parsed as `kind`. */
function listed<K extends 'mech' | 'crawler'>(
  rows: readonly ListedRow[] | undefined,
  kind: K,
  id: string
): (K extends 'mech' ? Mech : Crawler) | null {
  for (const row of rows ?? []) {
    const parsed = parseFrozenEntity(kind, row.body)
    if (!parsed.ok || parsed.kind !== kind) continue
    if ((row.appId ?? parsed.entity.id) !== id) continue
    return { ...parsed.entity, id } as K extends 'mech' ? Mech : Crawler
  }
  return null
}

function chassisName(mech: Mech): string | null {
  return (
    readReference('play.hangar', () => resolveChassisRef(mech.chassisRef)?.name, undefined) ?? null
  )
}

export function usePlayUnits(play: Play): PlayUnits {
  const { target, situation, canWrite } = play
  const store = useUnits()
  const { status } = useSync()
  const signedIn = isSignedIn(status)
  const listing = useQuery(
    api.entities.listForGame,
    signedIn && target.gameId !== null ? { gameId: target.gameId as Id<'games'> } : 'skip'
  )
  const links: readonly ListedLink[] = [...store.softLinks, ...(listing?.softLinks ?? [])]
  const linked = (type: string, match: (l: ListedLink) => boolean) =>
    links.find((l) => l.type === type && match(l)) ?? null

  // The mech: boarded, else assigned (`mech-to-pilot`), else the first of the pilot's own.
  const assignedId =
    linked('mech-to-pilot', (l) => l.to.id === target.pilotId)?.from.id ??
    play.mechs.find((o) => o.state === 'yours')?.mechId ??
    null
  const mechId = play.boardedMechId ?? assignedId
  const heldMech = mechId === null ? null : store.get('mech', mechId)
  const mech = heldMech ?? (mechId === null ? null : listed(listing?.mechs, 'mech', mechId))

  // The crawler: the pilot's (`pilot-to-crawler`), from the store or the listing.
  const crawlerId = linked('pilot-to-crawler', (l) => l.from.id === target.pilotId)?.to.id ?? null
  const heldCrawler = crawlerId === null ? null : store.get('crawler', crawlerId)
  const crawler =
    heldCrawler ?? (crawlerId === null ? null : listed(listing?.crawlers, 'crawler', crawlerId))

  const live = unitLiveness({
    situation,
    solo: target.gameId === null,
    mediator: target.mediator,
    canWrite,
    mechHeld: heldMech !== null && play.boardedMechId === heldMech.id,
    crawlerHeld: heldCrawler !== null,
  })

  const place: MechPlace =
    situation === 'downtime'
      ? 'downtime'
      : mech !== null && mech.id === play.boardedMechId
        ? 'boarded'
        : 'parked'

  const option: BoardOption | undefined =
    mech === null ? undefined : play.mechs.find((o) => o.mechId === mech.id)
  const mayBoard =
    canWrite &&
    mech !== null &&
    option !== undefined &&
    option.state === 'yours' &&
    boardable(option)

  const hangar = hangarMechs(play.mechs, mech?.id ?? null).map((o): HangarMech => {
    const record = store.get('mech', o.mechId)
    return {
      mechId: o.mechId,
      name: record?.name ?? o.name,
      chassis: record === null ? null : chassisName(record),
      note: o.state === 'destroyed' ? (o.note ?? 'Destroyed') : null,
    }
  })

  return {
    mech:
      mech === null
        ? null
        : {
            mech,
            place,
            restore:
              place === 'downtime'
                ? mechRestorePreview(mech, crawler, play.downtime.downtime.stepIndex)
                : {},
            held: heldMech !== null,
          },
    crawler: crawler === null ? null : { crawler, held: heldCrawler !== null },
    hangar,
    live,
    board: mayBoard && mech !== null ? () => play.board(mech.id) : null,
  }
}
