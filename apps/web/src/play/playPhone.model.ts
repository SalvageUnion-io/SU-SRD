/**
 * Play's phone form (play.md §11, ADR-051 §10, wireframe phone): below the
 * canvas's floor Play is tabs, not a second layout, under the live vitals
 * pinned for the Situation.
 *
 *  - The player's tabs: Act, Units, Tables, Crew (`playerPhoneTabs`). Crew is
 *    a Game's, as the canvas's Crew section is, so a solo screen has three.
 *  - The Mediator's: Table, Opposition, Tables, Propose (`mediatorPhoneTabs`;
 *    the second reads Downtime while it runs).
 *  - The pinned vitals (`pinnedUnits`): what a spend reads. On foot the
 *    pilot's HP and AP; Boarded those and the mech's SP, EP and Heat; in
 *    Downtime nothing, since nothing spends (play.md §11) and the step box
 *    leads the Act tab.
 *
 * A form is a renderer, never a second home for play state (ADR-045 §1): the
 * tabs hold the canvas's own column components.
 */

import type { Crawler } from 'game-domain/schemas/crawler'
import type { Mech } from 'game-domain/schemas/mech'
import type { Pilot } from 'game-domain/schemas/pilot'
import type { Situation } from './situation.model'
import type { UnitGauge } from './unitStats.model'
import { mechStats, pilotVitals } from './unitStats.model'

export type PhoneTab<Value extends string> = { value: Value; label: string }

export type PlayerPhoneTab = 'act' | 'units' | 'tables' | 'crew'

export type MediatorPhoneTab = 'table' | 'opposition' | 'tables' | 'propose'

const PLAYER_TABS: readonly PhoneTab<PlayerPhoneTab>[] = [
  { value: 'act', label: 'Act' },
  { value: 'units', label: 'Units' },
  { value: 'tables', label: 'Tables' },
  { value: 'crew', label: 'Crew' },
]

/** The player's tabs, in a fixed order a thumb learns; Crew only in a Game. */
export function playerPhoneTabs(solo: boolean): readonly PhoneTab<PlayerPhoneTab>[] {
  return solo ? PLAYER_TABS.filter((t) => t.value !== 'crew') : PLAYER_TABS
}

const MEDIATOR_TABS: readonly PhoneTab<MediatorPhoneTab>[] = [
  { value: 'table', label: 'Table' },
  { value: 'opposition', label: 'Opposition' },
  { value: 'tables', label: 'Tables' },
  { value: 'propose', label: 'Propose' },
]

/**
 * The Mediator's tabs. While Downtime runs the second holds the step track
 * in the Opposition's place, as the canvas's centre does, and says so; its
 * place in the row never moves.
 */
export function mediatorPhoneTabs(downtime: boolean): readonly PhoneTab<MediatorPhoneTab>[] {
  if (!downtime) return MEDIATOR_TABS
  return MEDIATOR_TABS.map((t) => (t.value === 'opposition' ? { ...t, label: 'Downtime' } : t))
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
