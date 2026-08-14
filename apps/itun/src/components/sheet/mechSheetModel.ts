/**
 * useMechSheetModel — everything the mech Live Sheet COMPUTES, in one place.
 *
 * Same split as the pilot body: this file derives, `mechSheetActions.ts`
 * mutates, `MechSheet.tsx` renders. Nothing here writes to the store.
 *
 * The one thing worth knowing before editing: the injectable `chassis` prop is
 * a NARROW stat subset (tests pass a literal), while the identity meta and the
 * chassis abilities need the FULL reference record. Both are resolved here and
 * returned separately — `chassis` for the stat derivations, `chassisEntity`
 * for everything the card renders.
 */

import type { ChassisStatItem, ProvenanceLine } from 'component-lib'
import { linesFromBreakdown } from 'component-lib'
import { SalvageUnionReference } from 'salvageunion-reference'
import {
  computeMechCapacity,
  resolveChassisRef,
  resolveGauge,
  resolvePool,
} from 'salvageunion-reference/rules'
import { useCargo } from '../../lib/cargo/useCargo'
import { mechMaxEPParts, mechMaxHeatParts, mechMaxSPParts } from '../../lib/rules/derivedStats'
import { pilotingContext } from '../../lib/rules/pilotingContext'
import type { Crawler } from '../../lib/schemas/crawler'
import type { Mech } from '../../lib/schemas/mech'
import type { useEntityStore } from '../../stores/entityStore'

/** Narrow subset of chassis data the stat derivations need. */
export type ChassisLike = {
  name: string
  structurePoints?: number
  energyPoints?: number
  heatCapacity?: number
  systemSlots?: number
  moduleSlots?: number
  cargoCapacity?: number
}

function resolveChassis(mech: Mech, override?: ChassisLike | null): ChassisLike | null {
  if (override !== undefined) return override
  return resolveChassisRef(mech.chassisRef)
}

type MechSheetModelOptions = {
  mech: Mech
  /** Injectable narrow chassis for tests; omitted resolves from `chassisRef`. */
  chassisOverride?: ChassisLike | null
  store: typeof useEntityStore
  readOnly: boolean
  crawler: Crawler | null
  pilotAbilities?: string[]
}

export type MechSheetModel = {
  /** The narrow stat chassis — null renders the "unknown chassis" notice. */
  chassis: ChassisLike | null
  cargo: ReturnType<typeof useCargo>
  spParts: ReturnType<typeof mechMaxSPParts>
  epParts: ReturnType<typeof mechMaxEPParts>
  heatParts: ReturnType<typeof mechMaxHeatParts>
  maxSP: number
  maxEP: number
  heatCap: number
  currentSP: number
  currentEP: number
  currentHeat: number
  capacity: ReturnType<typeof computeMechCapacity>
  chassisName: string
  chassisAbilities: NonNullable<ReturnType<typeof SalvageUnionReference.resolveActions>>
  spLines: ProvenanceLine[]
  epLines: ProvenanceLine[]
  heatLines: ProvenanceLine[]
  /** The poster's 8-lozenge chassis-stats strip. */
  specs: ChassisStatItem[]
  /** The linked crawler's scrap pool, or null when unlinked. */
  scrapPool: NonNullable<Crawler['scrapPool']> | null
}

export function useMechSheetModel({
  mech,
  chassisOverride,
  store,
  readOnly,
  crawler,
  pilotAbilities,
}: MechSheetModelOptions): MechSheetModel {
  const chassis = resolveChassis(mech, chassisOverride)
  const cargo = useCargo({ mech, crawler, store, readOnly, pilotAbilities })

  // Derived maxima (plan 2.5): chassis stat + hand-edited modifiers.
  // Beefcake is a PILOT ability that raises the piloted MECH's Max SP and Cargo,
  // so a mech's maxima cannot be derived from the mech alone (ADR-029).
  const piloting = pilotingContext(mech, pilotAbilities)
  const spParts = mechMaxSPParts(mech, chassis, piloting)
  const epParts = mechMaxEPParts(mech, chassis, piloting)
  const heatParts = mechMaxHeatParts(mech, chassis, piloting)
  const maxSP = spParts.total
  const maxEP = epParts.total
  const heatCap = heatParts.total
  const currentSP = resolvePool(mech.currentSP, maxSP)
  const currentEP = resolvePool(mech.currentEP, maxEP)
  const currentHeat = resolveGauge(mech.currentHeat, heatCap)

  // Slot budgets for the picker's loadout panel (soft — never blocks).
  const capacity = computeMechCapacity({
    chassisRef: mech.chassisRef,
    systems: mech.systems.map((ref) => ({ ref })),
    modules: mech.modules.map((ref) => ({ ref })),
  })

  // Chassis abilities AND the identity meta (chassis name, Tech Level, Salvage
  // Value) come from the FULL reference chassis — the injectable `chassis`
  // override only carries the narrow stat subset above.
  const chassisEntity = resolveChassisRef(mech.chassisRef)
  const chassisAbilities = chassisEntity
    ? (SalvageUnionReference.resolveActions(chassisEntity) ?? [])
    : []
  const chassisName = chassisEntity?.name ?? chassis?.name ?? mech.chassisRef

  // Stat provenance ledgers (ADR-029). The installed line is a single aggregate
  // until the contribution model can attribute it per item.
  const spLines = linesFromBreakdown(spParts, {
    base: `${chassisName} chassis`,
    baseDetail: 'base',
    installed: 'Installed systems & modules',
  })
  const epLines = linesFromBreakdown(epParts, {
    base: `${chassisName} chassis`,
    baseDetail: 'base',
    installed: 'Installed systems & modules',
  })
  const heatLines = linesFromBreakdown(heatParts, {
    base: `${chassisName} chassis`,
    baseDetail: 'base',
    installed: 'Installed systems & modules',
  })
  const techLevel =
    typeof chassisEntity?.techLevel === 'number' ? chassisEntity.techLevel : undefined

  // The poster's 8-lozenge chassis-stats strip (identity card body):
  // Structure/Energy/Heat maxima, System/Module slot usage, Cargo usage,
  // Tech Level, Salvage Value — number-only lozenges, a bounded 4-col grid
  // rather than a free-wrapped strip.
  const specs: ChassisStatItem[] = [
    { code: 'SP', value: maxSP },
    { code: 'EP', value: maxEP },
    { code: 'HEAT', value: heatCap },
    { code: 'SYS', value: capacity.systemSlotsUsed, max: capacity.systemSlotsMax },
    { code: 'MOD', value: capacity.moduleSlotsUsed, max: capacity.moduleSlotsMax },
    { code: 'CARGO', value: cargo.usage.used, max: cargo.usage.cap },
    ...(techLevel !== undefined ? [{ code: 'TL', value: techLevel }] : []),
    ...(typeof chassisEntity?.salvageValue === 'number'
      ? [{ code: 'SV', value: chassisEntity.salvageValue }]
      : []),
  ]

  const scrapPool = crawler ? (crawler.scrapPool ?? {}) : null

  return {
    chassis,
    cargo,
    spParts,
    epParts,
    heatParts,
    maxSP,
    maxEP,
    heatCap,
    currentSP,
    currentEP,
    currentHeat,
    capacity,
    chassisName,
    chassisAbilities,
    spLines,
    epLines,
    heatLines,
    specs,
    scrapPool,
  }
}
