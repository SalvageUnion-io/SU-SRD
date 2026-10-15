/**
 * useMechSheetModel — everything the mech Live Sheet COMPUTES, in one place.
 *
 * Same split as the pilot body: this file derives, `mechSheetActions.model.ts`
 * mutates, `MechSheet.tsx` renders. Nothing here writes to the store.
 *
 * The one thing worth knowing before editing: the injectable `chassis` prop is
 * a NARROW stat subset (tests pass a literal), while the identity meta and the
 * chassis abilities need the FULL reference record. Both are resolved here and
 * returned separately — `chassis` for the stat derivations, `chassisEntity`
 * for everything the card renders.
 */

import { pilotingContext } from 'cantina-domain/rules/pilotingContext'
import type { Crawler } from 'cantina-domain/schemas/crawler'
import type { Mech } from 'cantina-domain/schemas/mech'
import type { StatGroup } from 'salvageunion-reference'
import { parseContentBlockString, SalvageUnionReference, STAT_LABELS } from 'salvageunion-reference'
import {
  computeMechCapacity,
  mechMaxEPParts,
  mechMaxHeatParts,
  mechMaxSPParts,
  resolveChassisRef,
  resolveGauge,
  resolvePool,
} from 'salvageunion-reference/rules'
import { useCargo } from '../../lib/cargo/useCargo'
import type { useEntityStore } from '../../stores/entityStore'
import type { ProvenanceLine } from '../index'
import { linesFromBreakdown } from '../index'

/** One chassis stat as the strip prints it: the numeral and its full name. */
type ChassisStat = { key: string; label: string; value: string; group: StatGroup }

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
  /** The viewer may not write `crawler` (ADR-038 §5); see `useCargo`. */
  crawlerReadOnly?: boolean
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
  /** The chassis's reference entry, or null when the ref does not resolve. */
  chassisEntity: ReturnType<typeof resolveChassisRef>
  chassisAbilities: NonNullable<ReturnType<typeof SalvageUnionReference.resolveActions>>
  spLines: ProvenanceLine[]
  epLines: ProvenanceLine[]
  heatLines: ProvenanceLine[]
  /** The Chassis Stats strip, in the order and words of the official mech sheet. */
  chassisStats: ChassisStat[]
  /** The linked crawler's scrap pool, or null when unlinked. */
  scrapPool: NonNullable<Crawler['scrapPool']> | null
}

export function useMechSheetModel({
  mech,
  chassisOverride,
  store,
  readOnly,
  crawler,
  crawlerReadOnly = false,
  pilotAbilities,
}: MechSheetModelOptions): MechSheetModel {
  const chassis = resolveChassis(mech, chassisOverride)
  const cargo = useCargo({ mech, crawler, store, readOnly, crawlerReadOnly, pilotAbilities })

  // Derived maxima: chassis stat + hand-edited modifiers.
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
  const chassisName = chassisEntity?.name ?? chassis?.name ?? mech.chassisRef
  // The book writes a chassis ability once for every chassis that has it, with
  // "[(CHASSIS)]" where it names the chassis; the hero's Row leads with that
  // prose, so it reads "The Mazona has…".
  const chassisAbilities = (
    chassisEntity ? (SalvageUnionReference.resolveActions(chassisEntity) ?? []) : []
  ).map((ability) => ({
    ...ability,
    content: ability.content?.map((block) =>
      typeof block.value === 'string'
        ? { ...block, value: parseContentBlockString(block, chassisName) }
        : block
    ),
  }))

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

  // The Chassis Stats strip, in the stat order every surface keeps (`STATS`,
  // salvageunion-reference): Tech Level and Salvage Value, then Structure
  // Points, Energy Points and Heat Capacity, then System Slots, Module Slots
  // and Cargo Capacity, spelled out (`STAT_LABELS.label`), each group opening
  // a new row. Each is the machine's figure: SP/EP/Heat are the derived
  // maxima, the slots and cargo the chassis's capacities. What is in use reads
  // where it is used: the Systems and Modules counts and The Hold.
  const chassisStats: ChassisStat[] = [
    ...(techLevel !== undefined
      ? [
          {
            key: 'tech-level',
            label: 'Tech Level',
            value: String(techLevel),
            group: 'provenance' as const,
          },
        ]
      : []),
    ...(typeof chassisEntity?.salvageValue === 'number'
      ? [
          {
            key: 'salvage-value',
            label: STAT_LABELS.salvageValue.label,
            value: String(chassisEntity.salvageValue),
            group: 'provenance' as const,
          },
        ]
      : []),
    {
      key: 'sp',
      label: STAT_LABELS.structurePoints.label,
      value: String(maxSP),
      group: 'vitals',
    },
    { key: 'ep', label: STAT_LABELS.energyPoints.label, value: String(maxEP), group: 'vitals' },
    { key: 'heat', label: STAT_LABELS.heatCapacity.label, value: String(heatCap), group: 'vitals' },
    {
      key: 'system-slots',
      label: STAT_LABELS.systemSlots.label,
      value: String(capacity.systemSlotsMax),
      group: 'capacity',
    },
    {
      key: 'module-slots',
      label: STAT_LABELS.moduleSlots.label,
      value: String(capacity.moduleSlotsMax),
      group: 'capacity',
    },
    {
      key: 'cargo',
      label: STAT_LABELS.cargoCapacity.label,
      value: String(cargo.usage.cap),
      group: 'capacity',
    },
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
    chassisEntity,
    chassisAbilities,
    spLines,
    epLines,
    heatLines,
    chassisStats,
    scrapPool,
  }
}
