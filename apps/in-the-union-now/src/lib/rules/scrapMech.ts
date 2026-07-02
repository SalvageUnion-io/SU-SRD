/**
 * Scrap-a-mech rules (design-review R-7).
 *
 * Salvage Union Core Book p.248, the "Scrap" ability: "You break down an
 * Intact or Damaged Mech Chassis, System, Module, or Vehicle … It is
 * destroyed. You gain an amount of Scrap equal to its Salvage Value. This
 * Scrap has a Tech Level equal to the Mech Chassis, System, Module, or
 * Vehicle." Destroyed components are "entirely unusable and irreparable …
 * cannot be salvaged from or scrapped" (p.245) and yield nothing.
 *
 * NOTE (verified against the extract): retiring your own mech uses the Scrap
 * ability and yields the FULL Salvage Value per component, each at its own
 * Tech Level. Half-SV applies only to the Mech Salvage 2–5 wreck band
 * (p.248) and to Repair costs — not here. The design-review table's
 * "half-SV" shorthand was corrected against pp.244–248.
 *
 * `mechScrapComponents` resolves a stored Mech into components against
 * salvageunion-reference; everything else is pure arithmetic. The UI
 * (ScrapMechControl) shows the breakdown in the delete-confirm dialog and,
 * on confirm, deposits the buckets and deletes the mech.
 */

import { SalvageUnionReference } from 'salvageunion-reference'

import { addToScrapPool } from '../cargo/cargoTransfer'
import type { CargoLot } from '../schemas/cargoLot'
import type { ScrapPool } from '../schemas/crawler'
import type { ItemCondition, Mech } from '../schemas/mech'
import type { PoolDraw } from './crawlerEconomy'

export type ScrapMechComponentKind = 'chassis' | 'system' | 'module'

/** One scrappable component of a mech (chassis, or an installed system/module). */
export type ScrapMechComponent = {
  kind: ScrapMechComponentKind
  name: string
  /** Numeric TL 1–6 when known — the denomination of the yielded Scrap. */
  techLevel?: number
  salvageValue: number
  condition: ItemCondition
}

export type ScrapMechSkipReason = 'destroyed' | 'no-tech-level' | 'unresolved'

export type ScrapMechSkip = {
  name: string
  reason: ScrapMechSkipReason
}

export type ScrapMechBreakdown = {
  /** Scrap yielded per TL bucket (ascending TL, merged). */
  deposits: PoolDraw[]
  /** Total scrap pieces across all buckets. */
  total: number
  /** Components that yield nothing, with why (destroyed / unmappable TL). */
  skipped: ScrapMechSkip[]
}

/** Minimal read shape from a reference model. */
type RefItem = {
  id: string
  name: string
  techLevel?: unknown
  salvageValue?: unknown
}

/** Read a reference model defensively — empty when data isn't preloaded. */
function loadRef(all: () => ReadonlyArray<unknown>): RefItem[] {
  try {
    return (all() as ReadonlyArray<RefItem>).slice()
  } catch {
    return []
  }
}

function numericTl(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 6
    ? value
    : undefined
}

function numericSv(value: unknown): number {
  return typeof value === 'number' && value >= 0 ? value : 0
}

/** The mech fields the component resolver reads. */
export type ScrapMechInput = Pick<
  Mech,
  'chassisRef' | 'systems' | 'modules' | 'systemConditions' | 'moduleConditions' | 'destroyed'
>

/**
 * Resolve a stored mech into its scrappable components: the chassis (by
 * `chassisRef` name, per the app convention) plus every installed system and
 * module (by id-or-name slug), each carrying its live condition. Unresolved
 * refs are kept (SV 0, no TL) so the breakdown can report them.
 */
export function mechScrapComponents(mech: ScrapMechInput): ScrapMechComponent[] {
  const chassisItems = loadRef(() => SalvageUnionReference.Chassis.all())
  const systemItems = loadRef(() => SalvageUnionReference.Systems.all())
  const moduleItems = loadRef(() => SalvageUnionReference.Modules.all())

  const chassis = chassisItems.find((c) => c.name === mech.chassisRef || c.id === mech.chassisRef)
  const components: ScrapMechComponent[] = [
    {
      kind: 'chassis',
      name: chassis?.name ?? mech.chassisRef,
      techLevel: numericTl(chassis?.techLevel),
      salvageValue: numericSv(chassis?.salvageValue),
      // A destroyed mech (reactor meltdown / catastrophic damage) has a
      // destroyed chassis — it cannot be scrapped (p.245).
      condition: mech.destroyed ? 'destroyed' : 'intact',
    },
  ]

  const push = (kind: 'system' | 'module', slug: string, items: RefItem[]) => {
    const item = items.find((entry) => entry.id === slug || entry.name === slug)
    const conditions = (kind === 'system' ? mech.systemConditions : mech.moduleConditions) ?? {}
    components.push({
      kind,
      name: item?.name ?? slug,
      techLevel: numericTl(item?.techLevel),
      salvageValue: numericSv(item?.salvageValue),
      condition: conditions[slug] ?? 'intact',
    })
  }
  for (const slug of mech.systems) push('system', slug, systemItems)
  for (const slug of mech.modules) push('module', slug, moduleItems)

  return components
}

/**
 * Compute what scrapping the mech yields: every Intact or Damaged component
 * deposits its FULL Salvage Value in Scrap of its own Tech Level (p.248);
 * destroyed components yield nothing (p.245); components without a numeric
 * TL (unresolved refs, Bio/Nanite gear) have no scrap denomination and are
 * reported, never silently dropped.
 */
export function scrapMechBreakdown(components: ScrapMechComponent[]): ScrapMechBreakdown {
  const buckets = new Map<number, number>()
  const skipped: ScrapMechSkip[] = []

  for (const component of components) {
    if (component.condition === 'destroyed') {
      skipped.push({ name: component.name, reason: 'destroyed' })
      continue
    }
    if (component.techLevel === undefined) {
      skipped.push({
        name: component.name,
        reason: component.salvageValue === 0 ? 'unresolved' : 'no-tech-level',
      })
      continue
    }
    if (component.salvageValue <= 0) continue
    buckets.set(
      component.techLevel,
      (buckets.get(component.techLevel) ?? 0) + component.salvageValue
    )
  }

  const deposits = [...buckets.entries()]
    .map(([tl, count]) => ({ tl, count }))
    .sort((a, b) => a.tl - b.tl)
  return {
    deposits,
    total: deposits.reduce((sum, d) => sum + d.count, 0),
    skipped,
  }
}

/** Apply a breakdown's deposits to the crawler's shared scrap pool. */
export function depositScrapDeposits(pool: ScrapPool, deposits: PoolDraw[]): ScrapPool {
  return deposits.reduce((next, d) => addToScrapPool(next, d.tl, d.count), pool)
}

/**
 * Hand the retiring mech's cargo over to the crawler before the mech record
 * is deleted (nothing in the hold is part of the mech — losing it would be
 * silent data loss). Mirrors the stow semantics of `cargoTransfer`: SCRAP
 * lots deposit their TL pool bucket; every other lot moves into the crawler
 * hold whole.
 */
export function handOffCargo(
  mechLots: CargoLot[],
  crawlerLots: CargoLot[],
  pool: ScrapPool
): { crawlerLots: CargoLot[]; pool: ScrapPool } {
  let nextPool = pool
  const moved: CargoLot[] = []
  for (const lot of mechLots) {
    if (lot.cat === 'SCRAP' && lot.tl !== undefined) {
      nextPool = addToScrapPool(nextPool, lot.tl, lot.qty ?? lot.units)
    } else {
      moved.push(lot)
    }
  }
  return { crawlerLots: [...moved, ...crawlerLots], pool: nextPool }
}
