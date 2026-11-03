import type { UnitsStore } from '../../replica/units'
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

import { mechMaxima } from 'game-domain/rules/crewStatus'
import type { Crawler } from 'game-domain/schemas/crawler'
import type { Mech } from 'game-domain/schemas/mech'
import { parseContentBlockString, SalvageUnionReference } from 'salvageunion-reference'
import type { mechMaxEPParts, mechMaxHeatParts, mechMaxSPParts } from 'salvageunion-reference/rules'
import {
  computeMechCapacity,
  resolveChassisRef,
  resolveGauge,
  resolvePool,
} from 'salvageunion-reference/rules'
import type { ProvenanceLine } from '../../components/index'
import { linesFromBreakdown } from '../../components/index'
import { useCargo } from '../../lib/cargo/useCargo'
import {
  hasChassisModder,
  moddableChassisAbilities,
  moddedChassisAbility,
} from '../../lib/rules/chassisModder'

/** One chassis stat as the strip prints it: the numeral and its full name. */

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
  store: UnitsStore
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
  /** The linked crawler's scrap pool, or null when unlinked. */
  scrapPool: NonNullable<Crawler['scrapPool']> | null
  /**
   * Chassis Modder's pick (Core Book p.64) when the seated pilot holds it: the
   * Chassis Ability slugs they may add, and the one added (null: none). Null
   * when the pilot is not a Chassis Modder.
   */
  chassisModder: { options: string[]; current: string | null } | null
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

  // Derived maxima: chassis stat + hand-edited modifiers, the one derivation
  // Play and the crew list read (`mechMaxima`). Beefcake is a PILOT ability
  // that raises the piloted MECH's Max SP and Cargo, so a mech's maxima cannot
  // be derived from the mech alone (ADR-029). The sheet is the build, not a
  // seat: no effect is switched on here (`[]`).
  const {
    spParts,
    epParts,
    heatParts,
    maxSP,
    maxEP,
    maxHeat: heatCap,
  } = mechMaxima(mech, pilotAbilities, [], chassis)
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
  // "[(CHASSIS)]" where it names the chassis; the hero's Compact leads with that
  // prose, so it reads "The Mazona has…".
  const ownAbilities = chassisEntity
    ? (SalvageUnionReference.resolveActions(chassisEntity) ?? [])
    : []
  // Chassis Modder (Core Book p.64): one added Chassis Ability, in effect while
  // its Fabricator pilots the mech, reads after the chassis's own.
  const modded = moddedChassisAbility(mech, pilotAbilities)
  const chassisAbilities = [...ownAbilities, ...(modded ? [modded] : [])].map((ability) => ({
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

  const scrapPool = crawler ? (crawler.scrapPool ?? {}) : null

  const chassisModder = hasChassisModder(pilotAbilities)
    ? {
        options: moddableChassisAbilities(mech.chassisRef, crawler?.techLevel ?? null),
        current: modded ? (mech.moddedChassisAbility ?? null) : null,
      }
    : null

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
    scrapPool,
    chassisModder,
  }
}
