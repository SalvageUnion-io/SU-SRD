/**
 * usePlayActions — the Actions column's state (play.md §5): the one list
 * (`playActions.model.ts`), its type filter and Find, and the resolve of the
 * action the seat is resolving, driven by `useActionsDeck`, which spends and
 * rolls under the ADR-007 boundary.
 *
 * `resolving` on the seat stays the source of truth: a reload mid-roll keeps
 * the roll, and the crew sees it. The deck behind the resolve is the one the
 * Situation puts on hand: on foot the pilot's, Boarded the mech's and the
 * pilot's, in Downtime the mech Board would board and the pilot's (their
 * Downtime actions). Every die it reads is recorded on Play's one roll log
 * (`reportingRoll`, `playRolls.model.ts`), which puts it on the Feed, the
 * Game's log and, with Post on, Discord, once.
 */

import { resolveEffectiveCrawlerLevel } from 'game-domain/crawlerLevel'
import type { Crawler } from 'game-domain/schemas/crawler'
import type { Mech } from 'game-domain/schemas/mech'
import type { Pilot } from 'game-domain/schemas/pilot'
import { useRef, useState } from 'react'
import { resolveSheetComposition } from '../build/sheet/composition.model'
import { rollForTable } from '../components/index'
import { buildMechActions, buildPilotActions } from '../lib/rules/actionPatches'
import { useEntityStore } from '../stores/entityStore'
import type { PlayStore } from './play.model'
import type { ListEntry, TypeFilter } from './playActions.model'
import { buildActionList, filterEntries, splitOnHand } from './playActions.model'
import type { PlayRollMeta } from './playRolls.model'
import { reportingRoll } from './playRolls.model'
import type { Play } from './situation.model'
import type { ResolveModel } from './useActionsDeck'
import { useActionsDeck } from './useActionsDeck'
import type { MountState } from './useSeat'

/** What a test injects: the store the writes go to, and the dice. */
export type PlayActionsDeps = {
  store?: PlayStore
  rollFor?: typeof rollForTable
}

export type PlayActions = {
  /** The pilot, freshest from the store. */
  pilot: Pilot | null
  /** The boarded mech, or the one Board would board (whose actions wait on Boarded). */
  mech: Mech | null
  /** The pilot's crawler, if they ride one. */
  crawler: Crawler | null
  /** The pilot's effective crawler Tech Level (Stat Training). */
  crawlerTechLevel: number
  /** Every entry, in the list's order, before the filter. */
  entries: ListEntry[]
  filter: TypeFilter
  setFilter: (filter: TypeFilter) => void
  find: string
  setFind: (find: string) => void
  /** What the filter and Find leave: on hand, then not. */
  onHand: ListEntry[]
  away: ListEntry[]
  /** The seat's resolve, as the deck reads it. */
  resolve: ResolveModel
  /** The entry the seat is resolving, or null. */
  resolvingKey: string | null
  /** Open an on-hand action's resolve in its row (Use). */
  open: (key: string) => void
  /**
   * The dice a roll here reads, recorded under `label`. `outcome`, read once
   * the dice are, says what the roll came to ("Heat Check passed", a rumour).
   */
  rollFor: (
    tableName: string,
    label: string,
    options?: { plainD20s?: number; outcome?: () => string | undefined }
  ) => ReturnType<typeof rollForTable>
  store: PlayStore
}

export function usePlayActions(play: Play, deps: PlayActionsDeps = {}): PlayActions {
  const liveStore = useEntityStore()
  const store: PlayStore = deps.store ?? liveStore
  const baseRoll = deps.rollFor ?? rollForTable
  const { target, situation } = play

  const composition = resolveSheetComposition({
    kind: 'pilot',
    id: target.pilotId,
    links: liveStore.softLinks,
    store: { get: (type, id) => store.get(type, id) },
  })
  const pilot = store.get('pilot', target.pilotId) ?? play.pilot
  const crawler = composition.crawler
  const firstYours = play.mechs.find((m) => m.state === 'yours')
  // Boarded, the mech is the one aboard or none: never another mech, whose EP
  // and Heat a Push would write. On foot, the pilot's own (Downtime restores it).
  const mech =
    play.boardedMechId !== null
      ? (play.boardedMech ?? store.get('mech', play.boardedMechId))
      : (play.boardedMech ??
        (firstYours === undefined ? null : store.get('mech', firstYours.mechId)) ??
        composition.mech)

  const [filter, setFilter] = useState<TypeFilter>('All')
  const [find, setFind] = useState('')

  const entries = buildActionList({
    situation,
    pilotActions: pilot ? buildPilotActions(pilot) : [],
    mechActions: mech ? buildMechActions(mech) : [],
    hasMech: mech !== null,
  })
  const { onHand, away } = splitOnHand(filterEntries(entries, filter, find))

  /** What a roll reports, read when it lands. */
  const meta = (label: string, outcome?: () => string | undefined): PlayRollMeta => {
    const said = outcome?.()
    return said === undefined ? { label } : { label, outcome: said }
  }
  const rollFor: PlayActions['rollFor'] = async (tableName, label, options) =>
    reportingRoll(
      await baseRoll(
        tableName,
        options?.plainD20s === undefined ? undefined : { plainD20s: options.plainD20s }
      ),
      tableName,
      () => meta(label, options?.outcome)
    )

  // The deck's rolls are named for the action being resolved, read at the roll.
  const resolving = play.seat.seat.resolving
  const resolvingName = useRef<string | null>(null)
  resolvingName.current = resolving?.name ?? null
  const deckRoll: typeof rollForTable = async (tableName, options) =>
    reportingRoll(await baseRoll(tableName, options), tableName, () =>
      meta(resolvingName.current ?? tableName)
    )

  const mount: MountState =
    situation === 'onFoot' ? 'pilot' : situation === 'boarded' ? 'mech' : 'downtime'
  const deck = useActionsDeck({
    mech: situation === 'onFoot' ? null : mech,
    pilot,
    crawler,
    mount,
    resolving,
    onResolving: (next) =>
      next === null ? play.seat.clearResolving() : play.seat.setResolving(next),
    store,
    rollFor: deckRoll,
  })

  return {
    pilot,
    mech,
    crawler,
    crawlerTechLevel: (pilot ? resolveEffectiveCrawlerLevel(pilot, crawler) : undefined) ?? 1,
    entries,
    filter,
    setFilter,
    find,
    setFind,
    onHand,
    away,
    resolve: deck.resolve,
    resolvingKey: resolving?.ref ?? null,
    open: deck.open,
    rollFor,
    store,
  }
}
