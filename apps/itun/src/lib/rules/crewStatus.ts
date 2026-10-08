import {
  isPilotDead,
  mechMaxEPParts,
  mechMaxHeatParts,
  mechMaxSPParts,
  pilotMaxAPParts,
  pilotMaxHPParts,
  resolveChassisRef,
  resolveGauge,
  resolveModuleRef,
  resolveSystemRef,
} from 'salvageunion-reference/rules'
import { resolveEffectiveCrawlerLevel } from '../crawlerLevel'
import type { Crawler } from '../schemas/crawler'
import type { Mech } from '../schemas/mech'
import type { Pilot } from '../schemas/pilot'
import { pilotingContext } from './pilotingContext'

/**
 * A crewmate's derived maxima and status, computed one way for every surface
 * (docs/architecture/dashboard-redesign.md D6, §8 A3).
 *
 * The server serves these to the whole crew (`crew.vitals`, read by the Crew
 * tab), and the Dashboard's own slots read the same maxima (`slotModels.ts`),
 * so the ▲ on the Crew tab, a crewmate's row and the player's own Minor agree.
 * `test/convex/crewStatus.test.ts` holds the two sides to it on shared
 * fixtures.
 *
 * Pure. It reads the abilities, chassis, systems and modules schemas, so they
 * must be loaded first: `preload` in the browser, `loadReferenceData()`
 * (`convex/model/referenceData.ts`) on the server.
 */

/**
 * A pilot's max HP and AP. The crawler they crew (`pilot-to-crawler`) sets
 * the Stat Training bonus; with none, the pilot's own `crawlerLevel` does.
 */
export function pilotMaxima(pilot: Pilot, crawler: Pick<Crawler, 'techLevel'> | null) {
  const statInput = { ...pilot, crawlerTechLevel: resolveEffectiveCrawlerLevel(pilot, crawler) }
  const hpParts = pilotMaxHPParts(statInput)
  const apParts = pilotMaxAPParts(statInput)
  return {
    statInput,
    hpParts,
    apParts,
    maxHP: Math.max(0, hpParts.total),
    maxAP: Math.max(0, apParts.total),
  }
}

/**
 * A mech's max SP, EP and Heat. Beefcake is a PILOT ability that raises the
 * piloted MECH (ADR-029), so the pilot in it (or assigned to it) and the
 * effects their seat has switched on come in too.
 */
export function mechMaxima(
  mech: Mech,
  pilotAbilities: string[] | undefined,
  switchedOn: readonly string[]
) {
  const chassis = resolveChassisRef(mech.chassisRef)
  const active = Object.fromEntries(switchedOn.map((ref) => [ref, true]))
  const piloting = { ...pilotingContext(mech, pilotAbilities), active }
  const spParts = mechMaxSPParts(mech, chassis, piloting)
  return {
    chassis,
    active,
    piloting,
    spParts,
    maxSP: spParts.total,
    maxEP: mechMaxEPParts(mech, chassis, piloting).total,
    maxHeat: mechMaxHeatParts(mech, chassis, piloting).total,
  }
}

export type PilotStatus = {
  /** Derived max HP at or below 0 (rules A2). */
  dead: boolean
  /** Carrying at least one injury. */
  injured: boolean
  /** Ejected from their mech, and not aboard one since (the seat says). */
  ejected: boolean
}

export function pilotStatus(
  pilot: Pilot,
  crawler: Pick<Crawler, 'techLevel'> | null,
  ejected: boolean
): PilotStatus {
  return {
    dead: isPilotDead(pilotMaxima(pilot, crawler).statInput),
    injured: (pilot.injuries ?? []).length > 0,
    ejected,
  }
}

export type MechStatus = {
  destroyed: boolean
  shutdown: boolean
  /** Heat at the mech's Heat Capacity: the next point forces a Reactor Overload. */
  overheating: boolean
  /** Destroyed systems and modules, by name. */
  destroyedSystems: string[]
  destroyedModules: string[]
}

/** Each item whose condition is `destroyed`, by its reference name. */
function destroyedItems(
  conditions: Mech['systemConditions'],
  find: (ref: string) => { name: string } | null
): string[] {
  return Object.entries(conditions ?? {})
    .filter(([, condition]) => condition === 'destroyed')
    .map(([ref]) => find(ref)?.name ?? ref)
}

export function mechStatus(mech: Mech, maxHeat: number): MechStatus {
  return {
    destroyed: mech.destroyed === true,
    shutdown: mech.shutdown === true,
    overheating: maxHeat > 0 && resolveGauge(mech.currentHeat) >= maxHeat,
    destroyedSystems: destroyedItems(mech.systemConditions, resolveSystemRef),
    destroyedModules: destroyedItems(mech.moduleConditions, resolveModuleRef),
  }
}

/** Whether the Crew tab flags this pilot: dead, injured or ejected. */
export function pilotNeedsAttention(status: PilotStatus): boolean {
  return status.dead || status.injured || status.ejected
}

/** Whether the Crew tab flags this mech: destroyed, overheating, or an item destroyed. */
export function mechNeedsAttention(status: MechStatus): boolean {
  return (
    status.destroyed ||
    status.overheating ||
    status.destroyedSystems.length > 0 ||
    status.destroyedModules.length > 0
  )
}
