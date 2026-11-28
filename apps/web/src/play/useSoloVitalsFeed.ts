/**
 * The solo Feed's vitals lines (r6 A8): solo there is no Game's log to say
 * what changed, so this screen says it, one line per unit for what one act
 * moved: "Thresher · SP 10→7 · Heat 2→4". Changes to the same unit within
 * `MERGE_MS` (the room's window for a vital's line) fold into the open line,
 * keeping where each vital began; a vital back where it began leaves it. A
 * change another line of this screen already says (Vent's "Heat 6→0") is not
 * said twice.
 *
 * Every write to the units is seen, whichever control made it, by comparing
 * what the units hold with what they held: Play's writes have no single
 * funnel. `soloVitalsStep` is the pure part.
 */

import type { Mech } from 'game-domain/schemas/mech'
import type { Pilot } from 'game-domain/schemas/pilot'
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import type { LogDefaults } from '../build/sheet/changeLog.model'
import { logChanges } from '../build/sheet/changeLog.model'
import { logStory } from '../build/sheet/changeStory.model'
import { row, subscribe } from '../replica/replica'
import { roomOf } from '../replica/roomSocket'
import { MERGE_MS } from '../rooms/game/tableEvent'
import type { EntityLogRow } from '../rooms/ops'
import type { LastLine } from './feed.model'
import { lastVisitLines } from './feed.model'
import type { PlayRoll } from './playRolls.model'
import { dropPlayRollSlot, isDiceRoll, recordPlayRoll, usePlayRollLog } from './playRolls.model'
import { mechStats, pilotVitals } from './unitStats.model'

/** The vitals a solo line names, by the record's field. */
const LABELS: Readonly<Record<string, string>> = {
  currentHP: 'HP',
  currentAP: 'AP',
  currentSP: 'SP',
  currentEP: 'EP',
  currentHeat: 'Heat',
}

/** How near in time another line of this screen saying the same change is. */
const SAID_MS = 2_000

/** A unit as the solo Feed watches it: its id, name and the vitals it holds. */
export type WatchedUnit = { id: string; name: string; vitals: Readonly<Record<string, unknown>> }

/** One unit's open line: where each vital began and is now, and when it last moved. */
export type OpenLine = {
  slot: string
  from: Record<string, number>
  to: Record<string, number>
  at: number
}

/** A pilot's HP and AP as shown, a full pool where none is stored. */
export function pilotNumbers(pilot: Pilot): Record<string, number> {
  const [hp, ap] = pilotVitals(pilot, null).gauges
  return { currentHP: hp?.value ?? 0, currentAP: ap?.value ?? 0 }
}

/** A mech's SP, EP and Heat as shown. */
export function mechNumbers(mech: Mech, switchedOn: readonly string[]): Record<string, number> {
  const { sp, ep, heat } = mechStats(mech, undefined, switchedOn)
  return { currentSP: sp, currentEP: ep, currentHeat: heat }
}

const numbers = (vitals: Readonly<Record<string, unknown>>): Record<string, number> =>
  Object.fromEntries(
    Object.keys(LABELS).flatMap((field) =>
      typeof vitals[field] === 'number' ? [[field, vitals[field] as number]] : []
    )
  )

/** The line's words, or null when every vital it names is back where it began. */
export function lineLabel(name: string, line: Pick<OpenLine, 'from' | 'to'>): string | null {
  const moved = Object.keys(LABELS).filter(
    (field) => field in line.to && line.to[field] !== line.from[field]
  )
  if (moved.length === 0) return null
  return [name, ...moved.map((f) => `${LABELS[f]} ${line.from[f]}→${line.to[f]}`)].join(' · ')
}

/**
 * What one unit's change does to its open line: the line it is now (a new
 * one past `MERGE_MS`), or the same `open` when nothing moved. `said` drops a
 * vital whose change another line already says.
 */
export function soloVitalsStep(
  unitId: string,
  before: Readonly<Record<string, number>>,
  now: Readonly<Record<string, number>>,
  open: OpenLine | null,
  at: number,
  said: (text: string) => boolean = () => false
): OpenLine | null {
  const changed = Object.keys(now).filter(
    (f) => f in before && before[f] !== now[f] && !said(`${LABELS[f]} ${before[f]}→${now[f]}`)
  )
  if (changed.length === 0) return open
  const line =
    open !== null && at - open.at <= MERGE_MS
      ? { ...open, from: { ...open.from }, to: { ...open.to } }
      : { slot: `vitals:${unitId}:${at}`, from: {}, to: {}, at }
  for (const f of changed) {
    if (!(f in line.from)) line.from[f] = before[f] as number
    line.to[f] = now[f] as number
  }
  return { ...line, at }
}

/** Say each change to `units` on this screen's Feed, while `on` (solo). */
export function useSoloVitalsFeed(units: readonly WatchedUnit[], on: boolean): void {
  const log = usePlayRollLog()
  const held = useRef(new Map<string, Record<string, number>>())
  const lines = useRef(new Map<string, OpenLine>())
  const logRef = useRef<readonly PlayRoll[]>(log)
  logRef.current = log
  const key = JSON.stringify(units.map((u) => [u.id, numbers(u.vitals)]))
  // biome-ignore lint/correctness/useExhaustiveDependencies: `key` is what the units hold; the units are read through it.
  useEffect(() => {
    if (!on) return
    const at = Date.now()
    const said = (text: string) =>
      logRef.current.some(
        (r) =>
          !isDiceRoll(r) && r.slot === undefined && at - r.at <= SAID_MS && r.label.includes(text)
      )
    for (const unit of units) {
      const now = numbers(unit.vitals)
      const before = held.current.get(unit.id)
      held.current.set(unit.id, now)
      if (before === undefined) continue
      const open = lines.current.get(unit.id) ?? null
      const line = soloVitalsStep(unit.id, before, now, open, at, said)
      if (line === null || line === open) continue
      lines.current.set(unit.id, line)
      const label = lineLabel(unit.name, line)
      if (label === null) dropPlayRollSlot(line.slot)
      else recordPlayRoll({ tableName: '', rolls: [], label, slot: line.slot })
    }
  }, [key, on])
}

/**
 * A unit's Change Log, asked once the replica holds it: what came before
 * this visit does not change as Play writes (`useEntityLog` asks again at
 * every write, for the sheet's drawer).
 */
function useLogOnce(table: 'pilot' | 'mech', id: string): readonly EntityLogRow[] {
  const place = useSyncExternalStore(subscribe, () => {
    const held = id === '' ? null : row(table, id)
    return held === null ? null : ((held as { gameId?: string | null }).gameId ?? '')
  })
  const [rows, setRows] = useState<readonly EntityLogRow[]>([])
  useEffect(() => {
    setRows([])
    if (place === null) return
    const room = roomOf(place || null)
    if (room === null) return
    let current = true
    room.act('changeLog.forEntity', { entityId: id }).then(
      (answer) => current && setRows(answer as EntityLogRow[]),
      () => undefined
    )
    return () => {
      current = false
    }
  }, [place, id])
  return rows
}

/** A unit as "Last time" reads its Change Log (r7 A8): its kind, id, name and what an absent number stands for. */
export type LoggedUnit = { kind: 'pilot' | 'mech'; id: string; name: string; defaults: LogDefaults }

const NO_UNIT: LoggedUnit = { kind: 'pilot', id: '', name: '', defaults: {} }

/**
 * Solo, the last visit's lines (r7 A8): read from the pilot's and the mech's
 * Change Logs, which keep every write Play made, so the Feed opens with what
 * happened last time. `before` is this visit's first line. Empty in a Game,
 * whose own log holds what came before.
 */
export function useSoloLastTime(
  pilot: LoggedUnit | null,
  mech: LoggedUnit | null,
  before: number,
  on: boolean
): LastLine[] {
  const p = on && pilot !== null ? pilot : NO_UNIT
  const m = on && mech !== null ? mech : NO_UNIT
  const pilotLog = useLogOnce('pilot', p.id)
  const mechLog = useLogOnce('mech', m.id)
  const { name: pName, defaults: pDefaults } = p
  const { name: mName, defaults: mDefaults } = m
  // biome-ignore lint/correctness/useExhaustiveDependencies: a unit's defaults follow its log and name.
  return useMemo(() => {
    if (!on) return []
    const read = (name: string, rows: readonly EntityLogRow[], defaults: LogDefaults) =>
      name === '' ? [] : [{ name, changes: logStory(logChanges(rows, defaults)) }]
    return lastVisitLines(
      [...read(pName, pilotLog, pDefaults), ...read(mName, mechLog, mDefaults)],
      before
    )
  }, [on, pName, mName, pilotLog, mechLog, before])
}
