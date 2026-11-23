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
 *
 * An action of a unit that is Down (at 0 SP or 0 HP, r5 A1) asks "Thresher is
 * at 0 SP. Act anyway?" once, the first Use while it stays Down: the table
 * decides what a Down unit may do, so it is never refused.
 */

import { resolveEffectiveCrawlerLevel } from 'game-domain/crawlerLevel'
import { pilotLabel } from 'game-domain/pilotLabel'
import { closeRangeOnly, sceneHeatScale } from 'game-domain/rules/sceneConditions'
import type { Crawler } from 'game-domain/schemas/crawler'
import type { Mech } from 'game-domain/schemas/mech'
import type { Pilot } from 'game-domain/schemas/pilot'
import type { ReactNode } from 'react'
import { useRef, useState } from 'react'
import { resolveSheetComposition } from '../build/sheet/composition.model'
import { rollForTable } from '../components/index'
import { useConfirm } from '../components/shared/useConfirm'
import { buildCompanionActions, buildMechActions, buildPilotActions } from '../lib/rules/actionList'
import { activatableEffects, effectUsed } from '../lib/rules/activatableEffects'
import { playCopy } from '../messages/play'
import { useUnits } from '../replica/units'
import type { DeckRoll, ResolveModel } from './actionsDeck.model'
import type { PlayStore } from './play.model'
import type { ListEntry, TypeFilter } from './playActions.model'
import { buildActionList, filterEntries, splitOnHand } from './playActions.model'
import type { PlayRollMeta } from './playRolls.model'
import { reportingRoll } from './playRolls.model'
import type { Play } from './situation.model'
import { useActionsDeck } from './useActionsDeck'
import { useSalvageArea } from './useSalvageArea'
import { isDown } from './zeroVital.model'

/** The Down units whose Act anyway was answered, by id, until they rise (r5 A1). */
const actingDown = new Set<string>()

/** The unit an action of `source` belongs to, while it is Down; null else. */
function downUnit(
  source: string,
  pilot: Pilot | null,
  mech: Mech | null
): { id: string; name: string; label: string } | null {
  if (source === 'mech' && mech !== null && isDown(mech.currentSP))
    return { id: mech.id, name: mech.name, label: 'SP' }
  if (source === 'pilot' && pilot !== null && isDown(pilot.currentHP))
    return { id: pilot.id, name: pilotLabel(pilot), label: 'HP' }
  return null
}

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
  /**
   * The resolve was opened and nothing done with it (no roll, not activated,
   * not applied), on a screen that can write: one the list lets go without a
   * word when its action leaves the hand (`PlayOrphanResolve`).
   */
  resolvingUntouched: boolean
  /** The action that just finished and closed itself: its row says Done. */
  doneKey: string | null
  /** What that row says it came to (r6 A5). */
  doneSays: string
  /** Open an on-hand action's resolve in its row (Use); a Down unit's asks first (r5 A1). */
  open: (key: string) => void
  /** The Act anyway question, to render. */
  dialog: ReactNode
  /**
   * The dice a roll here reads, recorded under `label`. `outcome`, read once
   * the dice are, says what the roll came to ("Heat Check passed", a rumour).
   */
  /** What the Scene's conditions multiply Heat gained by (`sceneHeatScale`). */
  heatScale: number
  /** The Scene's conditions limit sight and targeting to Close Range (Low Visibility). */
  closeOnly: boolean
  rollFor: (
    tableName: string,
    label: string,
    options?: { plainD20s?: number; outcome?: () => string | undefined }
  ) => ReturnType<typeof rollForTable>
  store: PlayStore
}

export function usePlayActions(play: Play, deps: PlayActionsDeps = {}): PlayActions {
  const liveStore = useUnits()
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
  // Boarded, the mech is the one aboard or none: never another mech, whose EP
  // and Heat a Push would write. On foot, the pilot's assigned mech (Downtime
  // restores it), or none for a pilot linked to no mech.
  const mech =
    play.boardedMechId !== null
      ? (play.boardedMech ?? store.get('mech', play.boardedMechId))
      : (play.boardedMech ?? composition.mech)

  const [filter, setFilter] = useState<TypeFilter>('All')
  const [find, setFind] = useState('')

  const entries = buildActionList({
    situation,
    pilotActions: pilot ? buildPilotActions(pilot) : [],
    mechActions: mech ? buildMechActions(mech) : [],
    hasMech: mech !== null,
    // The companions' actions join the board (R65).
    companionActions: [
      ...(pilot ? buildCompanionActions({ kind: 'pilot', id: pilot.id }, pilot.partners) : []),
      ...(mech ? buildCompanionActions({ kind: 'mech', id: mech.id }, mech.partners) : []),
    ],
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
  // A Push's Heat Check says itself (r7 A5): its own label and what it came to.
  const deckRoll: DeckRoll = async (tableName, options) =>
    reportingRoll(
      await baseRoll(
        tableName,
        options?.plainD20s === undefined ? undefined : { plainD20s: options.plainD20s }
      ),
      tableName,
      () => meta(options?.label ?? resolvingName.current ?? tableName, options?.outcome)
    )

  const heatScale = sceneHeatScale(play.scene.conditions)

  // The area an Area Salvage spends Supply from: the Game's, or the solo table's.
  const salvageArea = useSalvageArea(target)

  const deck = useActionsDeck({
    mech: situation === 'onFoot' ? null : mech,
    pilot,
    crawler,
    situation,
    resolving,
    onResolving: (next) => {
      if (next === null) return play.seat.clearResolving()
      // A Pilot ability used while Boarded switches its effect on (r8 A8):
      // the Mech's Effects list it once it is in force.
      const used = effectUsed(
        resolving,
        next,
        entries.flatMap((e) => (e.kind === 'action' && e.key === next.ref ? [e.action] : []))[0],
        situation === 'boarded' && mech !== null ? activatableEffects(mech, pilot?.abilities) : [],
        play.seat.seat.activeEffects
      )
      if (used !== null) play.seat.toggleEffect(used)
      return play.seat.setResolving(next)
    },
    held: play.seat.seat.held === true,
    store,
    rollFor: deckRoll,
    heatScale,
    salvageArea,
  })

  // Risen units are asked again the next time they go Down.
  for (const id of [...actingDown]) {
    const current = id === pilot?.id ? pilot.currentHP : id === mech?.id ? mech.currentSP : null
    if (current !== null && !isDown(current)) actingDown.delete(id)
  }
  const { confirm, dialog } = useConfirm()
  const open = (key: string) => {
    const entry = entries.find((e) => e.key === key)
    const down = entry?.kind === 'action' ? downUnit(entry.source, pilot, mech) : null
    if (down === null || actingDown.has(down.id)) return deck.open(key)
    confirm({
      title: playCopy('downActAnyway', { name: down.name, label: down.label }),
      body: [playCopy('downActAnywayBody')],
      confirmLabel: playCopy('actAnyway'),
      pendingLabel: playCopy('actAnyway'),
      tone: 'default',
      failure: playCopy('actAnyway'),
      onConfirm: () => {
        actingDown.add(down.id)
        deck.open(key)
      },
    })
  }

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
    resolvingUntouched:
      resolving != null &&
      play.readOnly === null &&
      resolving.roll === undefined &&
      resolving.salvage === undefined &&
      !resolving.activated &&
      !resolving.applied,
    open,
    dialog,
    doneKey: deck.doneKey,
    doneSays: deck.doneSays,
    heatScale,
    closeOnly: closeRangeOnly(play.scene.conditions),
    rollFor,
    store,
  }
}
