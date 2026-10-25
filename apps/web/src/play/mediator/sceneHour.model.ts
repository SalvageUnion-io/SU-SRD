/**
 * An hour passing under the Scene's conditions, as the Mediator's "An hour
 * passes" works it out (play.md §10), pure: no React and no I/O.
 *
 * Each seat at the table is exposed one way: aboard, its Mech is (its Pilot is
 * inside and safe, Workshop Manual p.306); on foot, its Pilot is.
 * `sceneHourCost` says what the hour costs that unit, and this turns it into
 * the Mediator's proposals (ADR-030 §4): SP and Heat on the Mech, HP on the
 * Pilot, from the crew's own readings, each with the reason in words. The
 * Heat Check, the injuries and a damaged part are said, never written: the
 * player makes them (ADR-007).
 */

import type { SceneHourCost } from 'game-domain/rules/sceneConditions'
import { sceneHourCost } from 'game-domain/rules/sceneConditions'
import type { SceneConditionId } from 'game-domain/schemas/scene'
import { resolveGauge, resolvePoolStart } from 'salvageunion-reference/rules'
import { mediatorCopy } from '../../messages/play-mediator'
import type { CrewVitals } from '../useGameFeed'
import type { ProposeArgs } from './ProposeDock'

/** One exposed unit's hour, before its rolls. */
export type HourStep = {
  /** The pilot's row id: the seat this is. */
  key: string
  /** "Pickle's Spectrum", or the Pilot on foot: "Pickle". */
  label: string
  exposed: 'mech' | 'pilot'
  /** The unit the proposals address. */
  target: { id: string; kind: 'mech' | 'pilot' }
  /** What it holds now: SP and Heat aboard, HP on foot (unrecorded reads as full, Heat as 0). */
  reading: { pool: number; heat: number; heatCap: number }
  cost: SceneHourCost
}

/** The crew read's "not recorded" (null) as the pool rules take it. */
function unset(value: number | null): number | undefined {
  return value === null ? undefined : value
}

/** Every claimed seat the hour asks something of, in the crew's order. */
export function hourSteps(
  conditions: readonly SceneConditionId[],
  crew: Pick<CrewVitals, 'pilots' | 'mechs'> | null
): HourStep[] {
  if (crew === null) return []
  const mechs = new Map(crew.mechs.map((m) => [m.linkId, m]))
  return crew.pilots.flatMap((pilot): HourStep[] => {
    if (pilot.ownerId === null) return []
    const mech = pilot.boarded && pilot.mechId !== null ? mechs.get(pilot.mechId) : undefined
    if (mech !== undefined) {
      const cost = sceneHourCost(conditions, 'mech')
      if (cost.from.length === 0) return []
      return [
        {
          key: pilot._id,
          label: mediatorCopy('mechOfPilot', { pilot: pilot.name, mech: mech.name }),
          exposed: 'mech',
          target: { id: mech._id, kind: 'mech' },
          reading: {
            pool: resolvePoolStart(unset(mech.currentSP), mech.maxSP ?? 0),
            heat: resolveGauge(unset(mech.currentHeat)),
            heatCap: mech.maxHeat ?? Number.POSITIVE_INFINITY,
          },
          cost,
        },
      ]
    }
    const cost = sceneHourCost(conditions, 'pilot')
    if (cost.from.length === 0) return []
    return [
      {
        key: pilot._id,
        label: pilot.name,
        exposed: 'pilot',
        target: { id: pilot._id, kind: 'pilot' },
        reading: {
          pool: resolvePoolStart(unset(pilot.currentHP), pilot.maxHP ?? 0),
          heat: 0,
          heatCap: 0,
        },
        cost,
      },
    ]
  })
}

/**
 * The proposals one step makes, `extraDamage` from its rolls (Freezing's cold
 * erosion) added: SP and Heat for a Mech, HP for a Pilot, each held to its
 * pool (0 up, the Heat Cap down). None where the hour changes nothing.
 */
export function hourProposals(step: HourStep, extraDamage: number, reason: string): ProposeArgs[] {
  const damage = step.cost.damage + extraDamage
  const out: ProposeArgs[] = []
  const { id, kind } = step.target
  if (damage > 0) {
    out.push({
      entityId: id,
      entityType: kind,
      field: kind === 'mech' ? 'currentSP' : 'currentHP',
      after: Math.max(0, step.reading.pool - damage),
      reason,
    })
  }
  if (kind === 'mech' && step.cost.heat > 0) {
    out.push({
      entityId: id,
      entityType: 'mech',
      field: 'currentHeat',
      after: Math.min(step.reading.heatCap, step.reading.heat + step.cost.heat),
      reason,
    })
  }
  return out
}
