/**
 * Environmental conditions a Scene can be under, and what each does to Heat
 * and to an hour spent in it.
 *
 * The Workshop Manual's Radiation Storm (pp.305–306) and Irradiated (p.323),
 * and False Flag's environmental conditions (p.9): Freezing, Low Visibility,
 * Difficult Terrain and the Anomalous Zone. The Mediator puts a Scene under
 * any of them; Play scales the Heat a Mech gains while they hold and works out
 * what an hour costs each exposed unit.
 *
 * Pure: no dice and no writes. An hour's rolls (Freezing, the Anomalous Zone)
 * are named here and rolled by the caller, and its damage is proposed to the
 * player, never written for them (ADR-007). Injuries are said, not applied.
 */

import { SalvageUnionReference } from 'salvageunion-reference'
import { PUSH_HEAT } from 'salvageunion-reference/rules'
import type { SceneConditionId } from '../schemas/scene'
import { SCENE_CONDITION_IDS } from '../schemas/scene'

/** What one hour in a condition does, before any roll. */
type ConditionHour = {
  /** SP an exposed Mech takes. */
  mechDamage: number
  /** Heat an exposed Mech gains, as printed (not itself scaled). */
  mechHeat: number
  /** The Mech then makes a Heat Check. */
  heatCheck: boolean
  /** A table each exposed Mech rolls on. */
  mechTable: string | null
  /** HP an exposed Pilot takes. */
  pilotDamage: number
  /** The injury an exposed Pilot suffers. */
  pilotInjury: 'minor' | 'major' | null
  /** A table the Mediator rolls once for the Scene. */
  table: string | null
}

export type SceneCondition = {
  id: SceneConditionId
  name: string
  /** The id of the keyword in `keywords.json` that holds its rules text. */
  keyword: string
  source: 'Salvage Union Workshop Manual' | 'False Flag'
  /** What the Heat a Mech gains is multiplied by. */
  heatScale: number
  /** What an hour does; null when the condition asks nothing hourly. */
  hour: ConditionHour | null
  /** Pilots see and target at Close Range only. */
  closeRangeOnly: boolean
}

const NO_HOUR: ConditionHour = {
  mechDamage: 0,
  mechHeat: 0,
  heatCheck: false,
  mechTable: null,
  pilotDamage: 0,
  pilotInjury: null,
  table: null,
}

export const SCENE_CONDITIONS: Record<SceneConditionId, SceneCondition> = {
  // A Pilot within a Mech is safe; each hour a Mech takes 2 SP, gains 2 Heat
  // and makes a Heat Check, and generates twice the Heat (pp.305–306).
  'radiation-storm': {
    id: 'radiation-storm',
    name: 'Radiation Storm',
    keyword: '494c010c-8766-4156-b210-f2091cb377b6',
    source: 'Salvage Union Workshop Manual',
    heatScale: 2,
    hour: { ...NO_HOUR, mechDamage: 2, mechHeat: 2, heatCheck: true, pilotInjury: 'major' },
    closeRangeOnly: false,
  },
  // Mechs gain 1 Heat every hour; exposed Pilots a Major Injury every day (p.323).
  irradiated: {
    id: 'irradiated',
    name: 'Irradiated',
    keyword: '31ec6f97-4deb-49e9-a9b7-0fa7dc6dd709',
    source: 'Salvage Union Workshop Manual',
    heatScale: 1,
    hour: { ...NO_HOUR, mechHeat: 1 },
    closeRangeOnly: false,
  },
  // Heat gained is halved; each hour a Mech rolls on the Freezing table, and
  // an unprotected Pilot takes 2 HP and a Minor Injury (False Flag p.9).
  freezing: {
    id: 'freezing',
    name: 'Freezing',
    keyword: '98451035-4cab-4368-a77e-c0a794c16876',
    source: 'False Flag',
    heatScale: 0.5,
    hour: { ...NO_HOUR, mechTable: 'Freezing', pilotDamage: 2, pilotInjury: 'minor' },
    closeRangeOnly: false,
  },
  'low-visibility': {
    id: 'low-visibility',
    name: 'Low Visibility',
    keyword: '085a8f47-515a-4d39-bb45-030be5d7d550',
    source: 'False Flag',
    heatScale: 1,
    hour: null,
    closeRangeOnly: true,
  },
  'difficult-terrain': {
    id: 'difficult-terrain',
    name: 'Difficult Terrain',
    keyword: '983eeb85-ffca-411f-9fab-b65035046173',
    source: 'False Flag',
    heatScale: 1,
    hour: null,
    closeRangeOnly: false,
  },
  'anomalous-zone': {
    id: 'anomalous-zone',
    name: 'Anomalous Zone',
    keyword: 'db7ec650-f93e-4397-a1f9-46ee2080fc71',
    source: 'False Flag',
    heatScale: 1,
    hour: { ...NO_HOUR, table: 'Anomalous Zone' },
    closeRangeOnly: false,
  },
}

/** The conditions in catalogue order, each once, whatever order they were given in. */
export function sceneConditionsOf(ids: readonly string[]): SceneCondition[] {
  return SCENE_CONDITION_IDS.filter((id) => ids.includes(id)).map((id) => SCENE_CONDITIONS[id])
}

/** A condition's rules text, verbatim: its keyword's paragraphs (`keywords.json`). */
export function sceneConditionText(condition: SceneCondition): string[] {
  const keyword = SalvageUnionReference.Keywords.getById(condition.keyword)
  return (keyword?.content ?? []).flatMap((block) =>
    block.type === 'paragraph' && typeof block.value === 'string' ? [block.value] : []
  )
}

/** What every Heat gain is multiplied by under these conditions: 2 in a storm, ½ Freezing, 1 under both. */
export function sceneHeatScale(ids: readonly string[]): number {
  return sceneConditionsOf(ids).reduce((scale, c) => scale * c.heatScale, 1)
}

/**
 * The Heat a gain comes to at `scale`, rounded down (Core Book p.233: always
 * round down). A Push in a Radiation Storm is 4 (p.306); Freezing, 1.
 */
export function scaleHeat(heat: number, scale: number): number {
  return Math.floor(heat * scale)
}

/** The Heat a Push adds at `scale`. */
export function pushHeatAt(scale: number): number {
  return scaleHeat(PUSH_HEAT, scale)
}

/** Whether any condition limits sight and targeting to Close Range. */
export function closeRangeOnly(ids: readonly string[]): boolean {
  return sceneConditionsOf(ids).some((c) => c.closeRangeOnly)
}

/** What an hour does to one exposed Mech, or to one Pilot on foot, before its rolls. */
export type SceneHourCost = {
  damage: number
  heat: number
  heatCheck: boolean
  /** Tables the unit rolls on, one roll each. */
  tables: string[]
  injuries: ('minor' | 'major')[]
  /** The conditions that ask something of the unit, by name. */
  from: string[]
}

/**
 * What an hour under these conditions costs an exposed Mech (`'mech'`: SP,
 * Heat, the Heat Check and its tables; its Pilot is inside and safe) or a
 * Pilot on foot (`'pilot'`: HP and injuries). Several conditions add up.
 */
export function sceneHourCost(ids: readonly string[], exposed: 'mech' | 'pilot'): SceneHourCost {
  const cost: SceneHourCost = {
    damage: 0,
    heat: 0,
    heatCheck: false,
    tables: [],
    injuries: [],
    from: [],
  }
  for (const c of sceneConditionsOf(ids)) {
    const hour = c.hour
    if (hour === null) continue
    if (exposed === 'mech') {
      if (hour.mechDamage === 0 && hour.mechHeat === 0 && hour.mechTable === null) continue
      cost.damage += hour.mechDamage
      cost.heat += hour.mechHeat
      cost.heatCheck ||= hour.heatCheck
      if (hour.mechTable !== null) cost.tables.push(hour.mechTable)
    } else {
      if (hour.pilotDamage === 0 && hour.pilotInjury === null) continue
      cost.damage += hour.pilotDamage
      if (hour.pilotInjury !== null) cost.injuries.push(hour.pilotInjury)
    }
    cost.from.push(c.name)
  }
  return cost
}

/** The tables the Mediator rolls once for the whole Scene each hour. */
export function sceneHourTables(ids: readonly string[]): string[] {
  return sceneConditionsOf(ids).flatMap((c) => (c.hour?.table == null ? [] : [c.hour.table]))
}

/**
 * The SP a Mech takes from its Freezing roll (False Flag p.9): 1 on 11–19,
 * cold erosion. Every other row damages a part (a Module, a System, the
 * Chassis), which is the player's to mark (ADR-007), or nothing on a 20.
 */
export function freezingDamage(roll: number): number {
  return roll >= 11 && roll <= 19 ? 1 : 0
}
