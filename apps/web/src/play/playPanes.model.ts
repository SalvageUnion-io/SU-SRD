/**
 * Play's panes (play.md §11, ADR-063): what each screen's panes are, in
 * their tabs' order below `lg`, and the column each takes from it; and what
 * is pinned above them below `lg`.
 *
 *  - The player's (`playerPanes`): from `lg` Units | Act | Crew, then Tables,
 *    in the end column; below it the tabs Act, Crew, Rolls, Rules
 *    (`PLAYER_TABS`), the Units pane opened from ⋯. Crew is a Game's, so a
 *    solo screen has three.
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

import { pilotLabel } from 'game-domain/pilotLabel'
import type { Crawler } from 'game-domain/schemas/crawler'
import type { Mech } from 'game-domain/schemas/mech'
import type { Pilot } from 'game-domain/schemas/pilot'
import { playCopy } from '../messages/play'
import { mediatorCopy } from '../messages/play-mediator'
import type { ReactorState } from './reactorWrites.model'
import { reactorStates } from './reactorWrites.model'
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
  /** Something on this pane is pending; its tab wears a dot. */
  dot?: boolean
}

/** `rules` is the Reference inside Play: a tab below `lg`, under the Tables from it. */
export type PlayerPane = 'act' | 'units' | 'tables' | 'crew' | 'rules'

/** `rules` is the Reference beside the board from `lg`; below it, the Mediator's ⋯ opens it. */
export type MediatorPane = 'table' | 'opposition' | 'tables' | 'plan' | 'rules' | 'propose'

/** In reading order: Units | Act | Crew, then Tables, as the columns stand from `lg`. */
const PLAYER_PANES: readonly PaneSpec<PlayerPane>[] = [
  { value: 'units', label: 'Units', column: 'start' },
  { value: 'act', label: 'Act', column: 'centre' },
  { value: 'crew', label: 'Crew', column: 'end' },
  { value: 'tables', label: playCopy('rolls'), column: 'end' },
]

/** The player's panes in reading order; Crew only in a Game. */
export function playerPanes(solo: boolean): readonly PaneSpec<PlayerPane>[] {
  return solo ? PLAYER_PANES.filter((p) => p.value !== 'crew') : PLAYER_PANES
}

/**
 * The panes below `lg`: the roll tables are Rolls at every width (one
 * meaning for "Table"), and Rules is the Reference. `waiting` is the pane with something waiting (a
 * proposal to answer, in the Feed), whose tab wears the dot.
 */
export function playerPhonePanes(
  solo: boolean,
  waiting: PlayerPane | null
): readonly PaneSpec<PlayerPane>[] {
  const panes: readonly PaneSpec<PlayerPane>[] = [
    ...playerPanes(solo),
    { value: 'rules', label: playCopy('rules'), column: 'end' },
  ]
  return panes.map((p) => (p.value === waiting ? { ...p, dot: true } : p))
}

/**
 * The player's tabs below `lg`, in a fixed order a thumb learns: Act · Crew ·
 * Rolls · Rules. Units has no tab: its vitals are pinned above every pane,
 * and the bar's ⋯ opens the pane for the rest (range, effects, the hangar).
 */
export const PLAYER_TABS: readonly PlayerPane[] = ['act', 'crew', 'tables', 'rules']

const MEDIATOR_PANES: readonly PaneSpec<MediatorPane>[] = [
  { value: 'table', label: 'Table', column: 'start' },
  { value: 'opposition', label: 'Opposition', column: 'centre' },
  { value: 'tables', label: playCopy('rolls'), column: 'end' },
  { value: 'propose', label: 'Propose', column: 'end', dock: true },
]

/** The session plan and Game notes from Prep (r6 B7): a phone opens them from the ⋯. */
const MEDIATOR_PLAN: PaneSpec<MediatorPane> = {
  value: 'plan',
  label: mediatorCopy('plan'),
  column: 'end',
}

const MEDIATOR_RULES: PaneSpec<MediatorPane> = {
  value: 'rules',
  label: playCopy('rules'),
  column: 'end',
}

/**
 * The Mediator's panes. While Downtime runs the second holds the step track
 * in the Opposition's place and says so; its place in the row never moves.
 */
export function mediatorPanes(downtime: boolean, wide = false): readonly PaneSpec<MediatorPane>[] {
  // From `lg` the Plan and the Rules stand in the end column, under the Rolls
  // and above the Propose dock.
  const panes = wide
    ? MEDIATOR_PANES.flatMap((p) =>
        p.value === 'propose' ? [MEDIATOR_PLAN, MEDIATOR_RULES, p] : [p]
      )
    : MEDIATOR_PANES
  if (!downtime) return panes
  return panes.map((p) => (p.value === 'opposition' ? { ...p, label: 'Downtime' } : p))
}

/** One unit's pinned vitals, under its name. */
export type PinnedUnit = {
  kind: 'pilot' | 'mech'
  name: string
  vitals: UnitGauge[]
  /** A mech's Shut down and Vulnerable, which the strip says too (r7 B2). */
  states?: ReactorState[]
}

type PinnedArgs = {
  situation: Situation
  pilot: Pilot | null
  /** The pilot's crawler: its Tech Level raises max HP and AP. */
  crawler: Pick<Crawler, 'techLevel'> | null
  /** The mech the seat is boarded in, from the store. */
  boardedMech: Mech | null
  /** The seat's switched-on effects (ADR-029 §4), which move the mech's maxima. */
  activeEffects: readonly string[]
  /** In Downtime, the mech its steps restore (the pilot's assigned one); read, never boarded. */
  downtimeMech?: Mech | null
}

/** What is pinned above every tab, for the Situation: the live vitals a spend reads. */
export function pinnedUnits({
  situation,
  pilot,
  crawler,
  boardedMech,
  activeEffects,
  downtimeMech = null,
}: PinnedArgs): PinnedUnit[] {
  if (pilot === null) return []
  // In Downtime the numbers a step restores stay on screen too (r4 A10).
  const mech = situation === 'downtime' ? downtimeMech : boardedMech
  const units: PinnedUnit[] = [
    {
      kind: 'pilot',
      name: pilotLabel(pilot),
      vitals: pilotVitals(pilot, crawler).gauges,
    },
  ]
  if (situation !== 'onFoot' && mech !== null) {
    const s = mechStats(mech, pilot.abilities, activeEffects)
    units.push({
      kind: 'mech',
      name: mech.name,
      vitals: [
        { label: 'SP', value: s.sp, max: s.maxSP },
        { label: 'EP', value: s.ep, max: s.maxEP },
        { label: 'Heat', value: s.heat, max: s.maxHeat },
      ],
      states: reactorStates(mech.conditions),
    })
  }
  return units
}
