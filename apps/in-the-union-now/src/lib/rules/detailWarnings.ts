/**
 * Detail-view soft-warning derivation.
 *
 * The wizard Review steps surface soft warnings pre-save, but simply VIEWING an
 * entity on its detail route showed nothing — even when the stored entity has
 * warning-worthy state. These helpers derive the same advisory warnings for a
 * STATIC (unchanged) entity so the detail routes can render a passive
 * `<SoftWarningBanner>`.
 *
 * The evaluators in `softWarnings.ts` are change-based (before/after). For a
 * static view there is no change, so the pilot check passes `before === after`
 * (the stored snapshot) — its STATE-based prerequisites (tree order, 6-core
 * gates, one-Legendary, ability cap) are meaningful with an identical pair. The
 * mech and crawler checks reuse the capacity utilities directly (the same way
 * MechWizard / CrawlerBuilder derive their live capacity warnings), since the
 * change-based mech evaluator yields nothing useful for an unchanged loadout.
 *
 * All functions are pure and synchronous. They require `SalvageUnionReference`
 * to be preloaded (the app root preloads 'all'; the detail routes already
 * depend on it). With an empty ORM every helper degrades to an empty array,
 * never a throw.
 */

import { SalvageUnionReference } from 'salvageunion-reference'
import type { SURefSystem } from 'salvageunion-reference'

import { computeMechCapacity } from './capacity'
import { computeCrawlerCapacity } from './crawlerCapacity'
import { isWeaponSystem } from './crawlerSystems'
import { enrichPilotSnapshot } from './pilotSnapshot'
import { evaluatePilotWarnings } from './softWarnings'
import type { SoftWarning } from './types'

/**
 * Soft warnings for a stored pilot's current state. Enriches the pilot into a
 * snapshot and evaluates the state-based prerequisite checks with
 * `before === after` (no change — a static view).
 */
export function pilotDetailWarnings(pilot: {
  abilities: string[]
  classRef?: string
}): SoftWarning[] {
  const snapshot = enrichPilotSnapshot(pilot)
  return evaluatePilotWarnings({ before: snapshot, after: snapshot }, { entityType: 'pilot' })
}

/**
 * Soft warnings for a stored mech's loadout. Reuses `computeMechCapacity` and
 * surfaces the over-slot violations (the same subset MechWizard shows live).
 */
export function mechDetailWarnings(mech: {
  chassisRef: string
  systems: string[]
  modules: string[]
}): SoftWarning[] {
  const capacity = computeMechCapacity({
    chassisRef: mech.chassisRef,
    systems: mech.systems.map((ref) => ({ ref })),
    modules: mech.modules.map((ref) => ({ ref })),
  })
  return capacity.violations
    .filter((v) => v.kind === 'system-over-slots' || v.kind === 'module-over-slots')
    .map((v): SoftWarning => ({
      code: v.kind.toUpperCase().replace(/-/g, '_'),
      message: v.message,
      severity: 'warn',
    }))
}

/**
 * Soft warnings for a stored crawler. Reuses `computeCrawlerCapacity` and
 * surfaces the weapons-system over-capacity violation (the same check
 * CrawlerBuilder shows live). Crawler-specific rules beyond this are deferred
 * to M4 — the banner is intentionally empty otherwise.
 */
export function crawlerDetailWarnings(crawler: {
  type?: string
  techLevel: string
  systems: string[]
}): SoftWarning[] {
  const allSystems: SURefSystem[] = SalvageUnionReference.Systems.all()
  const selectedType = SalvageUnionReference.Crawlers.find(
    (t) => t.id === crawler.type || t.name === crawler.type
  )
  const isBattleCrawler = selectedType?.actions?.includes('Improved Armour and Armaments') ?? false

  const weaponSystems = crawler.systems.filter((id) => {
    const system = allSystems.find((s) => s.id === id)
    return system ? isWeaponSystem(system) : false
  })

  const capacity = computeCrawlerCapacity({
    techLevel: Number(crawler.techLevel) || 0,
    bays: [],
    weaponSystems,
    isBattleCrawler,
  })

  return capacity.violations
    .filter((v) => v.kind === 'weapon-systems-over-capacity')
    .map((): SoftWarning => ({
      code: 'weapon-systems-over-capacity',
      severity: 'warn',
      message: `Over capacity — ${capacity.weaponSystemsUsed} weapon systems installed, ${capacity.weaponSystemsMax} supported for this crawler type. You can still save; review before play.`,
    }))
}
