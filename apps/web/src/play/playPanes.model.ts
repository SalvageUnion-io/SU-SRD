/**
 * Play's panes (play.md §11, ADR-063): what each screen's panes are, in
 * their tabs' order below `lg`, and the column each takes from it; and what
 * is pinned above them below `lg`.
 *
 *  - The player's (`playerPanes`): from `lg` Units | Act | Crew, then Tables,
 *    in the end column; below it the tabs Act, Units, Tables, Crew
 *    (`PLAYER_TABS`). Crew is a Game's, so a solo screen has three.
 *  - The Mediator's: Table, Opposition, Tables, Propose (`mediatorPanes`; the
 *    second reads Downtime while it runs). From `lg`: Table | Opposition |
 *    Tables, then Propose docked at the column's foot.
 *  - The pinned vitals (`pinnedUnits`): what a spend reads. On foot the
 *    pilot's HP and AP; Boarded those and the mech's SP, EP and Heat; in
 *    Downtime nothing, since nothing spends and the step box leads Act.
 *
 * A pane is a renderer, never a second home for play state: each holds the
 * screen's own pane components at every width.
 */

import type { Crawler } from 'game-domain/schemas/crawler'
import type { Mech } from 'game-domain/schemas/mech'
import type { Pilot } from 'game-domain/schemas/pilot'
import type { Situation } from './situation.model'
import type { UnitGauge } from './unitStats.model'
import { mechStats, pilotVitals } from './unitStats.model'

/** Where a pane sits from `lg`. */
export type PlayColumn = 'start' | 'centre' | 'end'

/**
 * A pane, before the screen gives it its content: its tab's label below
 * `lg`, its column from it. A screen lists its panes in reading order.
 */
export type PaneSpec<Value extends string> = {
  value: Value
  label: string
  column: PlayColumn
  /** From `lg`, sits at the foot of its column (the Mediator's Propose dock). */
  dock?: boolean
}

export type PlayerPane = 'act' | 'units' | 'tables' | 'crew'

export type MediatorPane = 'table' | 'opposition' | 'tables' | 'propose'

/** In reading order: Units | Act | Crew, then Tables, as the columns stand from `lg`. */
const PLAYER_PANES: readonly PaneSpec<PlayerPane>[] = [
  { value: 'units', label: 'Units', column: 'start' },
  { value: 'act', label: 'Act', column: 'centre' },
  { value: 'crew', label: 'Crew', column: 'end' },
  { value: 'tables', label: 'Tables', column: 'end' },
]

/** The player's panes in reading order; Crew only in a Game. */
export function playerPanes(solo: boolean): readonly PaneSpec<PlayerPane>[] {
  return solo ? PLAYER_PANES.filter((p) => p.value !== 'crew') : PLAYER_PANES
}

/** The player's tabs below `lg`, in a fixed order a thumb learns: what a turn uses first. */
export const PLAYER_TABS: readonly PlayerPane[] = ['act', 'units', 'tables', 'crew']

const MEDIATOR_PANES: readonly PaneSpec<MediatorPane>[] = [
  { value: 'table', label: 'Table', column: 'start' },
  { value: 'opposition', label: 'Opposition', column: 'centre' },
  { value: 'tables', label: 'Tables', column: 'end' },
  { value: 'propose', label: 'Propose', column: 'end', dock: true },
]

/**
 * The Mediator's panes. While Downtime runs the second holds the step track
 * in the Opposition's place and says so; its place in the row never moves.
 */
export function mediatorPanes(downtime: boolean): readonly PaneSpec<MediatorPane>[] {
  if (!downtime) return MEDIATOR_PANES
  return MEDIATOR_PANES.map((p) => (p.value === 'opposition' ? { ...p, label: 'Downtime' } : p))
}

/** One unit's pinned vitals, under its name. */
export type PinnedUnit = { kind: 'pilot' | 'mech'; name: string; vitals: UnitGauge[] }

type PinnedArgs = {
  situation: Situation
  pilot: Pilot | null
  /** The pilot's crawler: its Tech Level raises max HP and AP. */
  crawler: Pick<Crawler, 'techLevel'> | null
  /** The mech the seat is boarded in, from the store. */
  boardedMech: Mech | null
  /** The seat's switched-on effects (ADR-029 §4), which move the mech's maxima. */
  activeEffects: readonly string[]
}

/** What is pinned above every tab, for the Situation: the live vitals a spend reads. */
export function pinnedUnits({
  situation,
  pilot,
  crawler,
  boardedMech,
  activeEffects,
}: PinnedArgs): PinnedUnit[] {
  if (situation === 'downtime' || pilot === null) return []
  const units: PinnedUnit[] = [
    {
      kind: 'pilot',
      name: pilot.name,
      vitals: pilotVitals(pilot, crawler).gauges,
    },
  ]
  if (situation === 'boarded' && boardedMech !== null) {
    const s = mechStats(boardedMech, pilot.abilities, activeEffects)
    units.push({
      kind: 'mech',
      name: boardedMech.name,
      vitals: [
        { label: 'SP', value: s.sp, max: s.maxSP },
        { label: 'EP', value: s.ep, max: s.maxEP },
        { label: 'Heat', value: s.heat, max: s.maxHeat },
      ],
    })
  }
  return units
}
