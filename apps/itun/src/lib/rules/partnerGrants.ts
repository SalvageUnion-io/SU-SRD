/**
 * partnerGrants — where a partner comes from, and when it goes away.
 *
 * A partner has no independent existence: it is granted, and it "cannot outlive
 * the thing that grants it" (see `lib/schemas/partner.ts`). Until now that
 * sentence was only a comment — nothing in the app ever CREATED a
 * `PartnerInstance`, so the two grant paths both leaked:
 *
 *   - Building a Little Sestra silently dropped its Sestra Drone, and a Big
 *     Brother on the DronTek pattern dropped all four of its drones. The mech
 *     sheet's Partners region was live code that could never render.
 *   - Equipping a pilot's Survey Drone / Auto-Turret / Mecha Companion produced
 *     an inert equipment card with no structure, no energy and no loadout.
 *
 * This module is the missing half. It answers "what does this host's current
 * configuration grant?" as a list of SEEDS, and reconciles that list against
 * whatever instances the host already carries.
 *
 * ── The grant is the lifecycle ───────────────────────────────────────────────
 *
 * Removal is tied to the grant, never to the partner card: you drop a pilot's
 * Survey Drone equipment and the drone goes with it; you change a mech's
 * chassis and its drones change with it. There is deliberately no standalone
 * "remove this partner" control, because a partner that could be removed on its
 * own would immediately be unrecoverable — nothing would ever grant it back.
 *
 * ── Both rosters are exact; only the SOURCE of the count differs ─────────────
 *
 * A MECH's count comes from its pattern, which says how many drones are fielded
 * and what each carries (Big Brother's DronTek fields four).
 *
 * A PILOT's count comes from their ABILITIES, while `pilot.equipment` is only
 * the gate. It has to work that way: `pilot.equipment` is a set, so it could
 * never express "two Mecha Companions", and Mecha Packmaster's `grants` already
 * lists Mecha Companion twice. See `partnerGrantCount` — including why it takes
 * the MAX across abilities rather than the sum.
 *
 * So one rule covers both: the seeds are the whole roster. What differs is
 * whether a surviving instance's loadout is re-cut from its seed
 * (`reseedLoadout`) — true for a mech, whose drones wear the pattern; false for
 * a pilot, whose partners are kitted out in play.
 */

import { nameToSlug, normalizePatternName, SalvageUnionReference } from 'salvageunion-reference'
import { matchesRef, resolveChassisRef } from 'salvageunion-reference/rules'
import type { PartnerInstance } from '../schemas/partner'

/**
 * An id-less partner: what a grant entitles the host to, before it becomes a
 * live instance with structure, heat and per-item conditions.
 */
export type PartnerSeed = {
  hostRef: string
  hostSchema: PartnerInstance['hostSchema']
  /** Set only when the pattern names the instance ("Shield Drone"). */
  name?: string
  systems: string[]
  modules: string[]
}

function isString(value: unknown): value is string {
  return typeof value === 'string'
}

function slugList(value: unknown): string[] {
  return Array.isArray(value) ? value.filter(isString).map(nameToSlug) : []
}

// ─── Mech-granted drones ─────────────────────────────────────────────────────

/**
 * The drone stat blocks a chassis ability names. A chassis carries the GRANT
 * (Little Sestra's "Sestra Drone Controller"); a pattern only kits it out.
 */
function grantedDroneNames(chassisRef: string): string[] {
  const chassis = resolveChassisRef(chassisRef)
  if (!chassis) return []
  const abilities = SalvageUnionReference.resolveActions(chassis) ?? []
  return abilities.map((ability) => ability.drone).filter(isString)
}

/**
 * Build a seed from a drone record plus the pattern's fitted loadout.
 *
 * The record's OWN `systems` are integrated hardware — both player-facing drones
 * carry a Hover Locomotion System that is part of the chassis, not a fitted
 * choice — so they ride alongside the pattern's picks rather than being replaced
 * by them. This is a deliberate divergence from the SRD pattern card, which
 * renders `config.systems` alone: the reference card is describing the pattern,
 * whereas a live drone has to account for every slot it is actually using.
 */
function seedFromDrone(
  statBlockName: string,
  fitted: { systems?: string[]; modules?: string[]; instanceName?: string }
): PartnerSeed[] {
  const record = SalvageUnionReference.getByNameIn('drones', statBlockName)
  if (!record) return []

  const fittedSystems = (fitted.systems ?? []).map(nameToSlug)
  const fittedModules = (fitted.modules ?? []).map(nameToSlug)
  // Guard against a pattern that re-lists integrated hardware: the same slug
  // twice would read as two installs and double-count against the slot cap.
  const integratedSystems = slugList(record.systems).filter((s) => !fittedSystems.includes(s))
  const integratedModules = slugList(record.modules).filter((m) => !fittedModules.includes(m))

  return [
    {
      hostRef: nameToSlug(record.name),
      hostSchema: 'drones',
      ...(fitted.instanceName !== undefined ? { name: fitted.instanceName } : {}),
      systems: [...integratedSystems, ...fittedSystems],
      modules: [...integratedModules, ...fittedModules],
    },
  ]
}

/**
 * Every drone a mech's chassis + pattern fields.
 *
 * A pattern with `drones[]` is authoritative — one seed per config, which is
 * what gives Big Brother's DronTek its four. Without one (a Custom build, or a
 * pattern that fields none) the chassis ability still grants its drone bare:
 * the ability is the grant, and "I built it custom" is not a reason to lose a
 * drone the chassis comes with.
 */
export function mechPartnerSeeds(chassisRef: string, patternName?: string): PartnerSeed[] {
  const droneNames = grantedDroneNames(chassisRef)
  if (droneNames.length === 0) return []

  const chassis = resolveChassisRef(chassisRef)
  const pattern =
    patternName && patternName.trim() !== ''
      ? (chassis?.patterns ?? []).find(
          (p) => normalizePatternName(p.name) === normalizePatternName(patternName)
        )
      : undefined

  const configs = pattern?.drones ?? []
  if (configs.length > 0) {
    return configs.flatMap((config) =>
      seedFromDrone(config.ref ?? config.name, {
        systems: config.systems,
        modules: config.modules,
        // A `ref` means the config's name is an INSTANCE name riding over a
        // shared stat block; without one the config already names the record.
        ...(config.ref ? { instanceName: config.name } : {}),
      })
    )
  }

  return droneNames.flatMap((name) => seedFromDrone(name, {}))
}

// ─── Pilot-granted partners ──────────────────────────────────────────────────

/**
 * The `equipment` record a slug resolves to, when that record carries a
 * mech-shaped stat block — i.e. when equipping it grants a partner.
 *
 * Derived from the data rather than hardcoded: `systemSlots` is what separates
 * Auto-Turret / Survey Drone / Mecha Companion from every other piece of gear,
 * and a fourth such record should light this up without an edit here.
 *
 * Requires `equipment` preloaded.
 */
function resolvePartnerEquipment(slug: string) {
  return SalvageUnionReference.Equipment.find(
    (entry) =>
      matchesRef(entry, slug) &&
      typeof (entry as { systemSlots?: unknown }).systemSlots === 'number'
  )
}

/** Whether equipping this slug grants a partner. */
export function isPartnerEquipment(slug: string): boolean {
  return resolvePartnerEquipment(slug) !== undefined
}

/**
 * How many of one partner a pilot's ABILITIES entitle them to.
 *
 * The multiplicity is in the data and always was: Mecha Packmaster's `grants`
 * lists Mecha Companion **twice**, and it is the only ability in the whole
 * dataset that grants the same thing more than once. Nothing read it — `grants`
 * fed the SRD's display layer and nothing else — so the second companion had no
 * way to exist.
 *
 * MAX, NOT SUM, and the distinction is load-bearing. The Ranger tree's Level 1
 * ability is `Mecha Companion` (one grant) and Packmaster is Legendary Ranger,
 * so a pilot who has Packmaster normally holds both abilities. Summing would
 * give three, contradicting Packmaster's own text — "Gain a second Mecha
 * Companion in addition to your first" — and the two entries therefore encode
 * the TOTAL a pilot ends up with, not an increment on top of the first ability.
 *
 * Floors at 1: a pilot may have equipped the item without the granting ability
 * (the live sheet is a Free-Edit surface, ADR-021), and that is still one
 * partner, not zero.
 */
export function partnerGrantCount(hostRef: string, abilityRefs: readonly string[]): number {
  const record = resolvePartnerEquipment(hostRef)
  if (!record) return 1
  const wanted = nameToSlug(record.name)

  let most = 0
  for (const ref of abilityRefs) {
    const ability = SalvageUnionReference.Abilities.find((entry) => matchesRef(entry, ref))
    if (!ability) continue
    const granted = (ability.grants ?? []).filter(
      (grant) => grant.schema === 'equipment' && nameToSlug(grant.name) === wanted
    ).length
    if (granted > most) most = granted
  }
  return Math.max(1, most)
}

/**
 * One seed per partner a pilot's equipment grants — `partnerGrantCount` copies
 * of each granting slug.
 *
 * Equipment membership is the GATE and abilities are the COUNT: unequipping the
 * item takes every instance with it, while Mecha Packmaster turns the one
 * equipment entry into two companions. `pilot.equipment` is a set (it is
 * toggled), so it could never have carried the count itself.
 *
 * The equipment records have no `systems`/`modules` of their own, so these seeds
 * are always bare — a pilot's partner starts empty and is kitted out in play,
 * unlike a mech's, which arrives wearing its pattern.
 */
export function pilotPartnerSeeds(
  equipment: readonly string[],
  abilityRefs: readonly string[] = []
): PartnerSeed[] {
  return equipment.filter(isPartnerEquipment).flatMap((slug) =>
    Array.from({ length: partnerGrantCount(slug, abilityRefs) }, () => ({
      hostRef: slug,
      hostSchema: 'equipment' as const,
      systems: [],
      modules: [],
    }))
  )
}

// ─── Reconciliation ──────────────────────────────────────────────────────────

function newInstance(seed: PartnerSeed, id: string): PartnerInstance {
  return {
    id,
    hostRef: seed.hostRef,
    hostSchema: seed.hostSchema,
    ...(seed.name !== undefined ? { name: seed.name } : {}),
    systems: [...seed.systems],
    modules: [...seed.modules],
    conditions: [],
  }
}

/** Whether an existing instance answers to a seed. */
function matchesSeed(partner: PartnerInstance, seed: PartnerSeed): boolean {
  if (partner.hostRef !== seed.hostRef || partner.hostSchema !== seed.hostSchema) return false
  // An unnamed seed matches any instance of its stat block — a player who
  // renamed their Sestra Drone "Custos" still owns the drone the chassis grants.
  // A NAMED seed must match its name, so Big Brother's four stay distinct.
  return seed.name === undefined || partner.name === seed.name
}

export type SyncPartnersOptions = {
  /**
   * Re-cut every surviving instance's `systems`/`modules` from its seed.
   *
   * TRUE for a mech, whose drones wear the pattern — the wizard already
   * rewrites the mech's own loadout on a pattern change, and a drone still
   * carrying the previous pattern's guns would be the odd one out.
   *
   * FALSE for a pilot, whose partners have bare seeds and are kitted out in
   * play. Re-seeding those would delete a loadout nothing can restore.
   */
  reseedLoadout?: boolean
  /** Injectable for deterministic tests. */
  mintId?: () => string
}

/**
 * Reconcile a host's `partners` against what it currently grants.
 *
 * THE SEED LIST IS THE WHOLE ROSTER, for both hosts. A partner with no seed to
 * answer to is dropped — that is what makes unequipping the Survey Drone take
 * the drone with it, and dropping Mecha Packmaster take the second companion.
 * This is only safe because the count is now derivable on both sides: a mech's
 * from its pattern, a pilot's from `partnerGrantCount`.
 *
 * It also relies on a data invariant that was NOT true before this change: a
 * pilot partner's `hostRef` must appear in `pilot.equipment`. The v12 migration
 * minted partners from companion-mech rows without adding the granting slug, so
 * those partners answered to no seed and would have been reaped on the owner's
 * next edit. Migration v15 heals them; see
 * `lib/db/migrations/15-partner-equipment-backfill.ts`.
 *
 * Live state is never collateral damage: a matched instance keeps its id,
 * structure, energy, heat, conditions, name, appearance, A.I. personality and
 * cargo. Only `reseedLoadout` touches anything else.
 *
 * Returns `undefined` when the host has, and should have, no partners, so the
 * field stays absent rather than persisting an empty array.
 */
export function syncPartners(
  existing: readonly PartnerInstance[] | undefined,
  seeds: readonly PartnerSeed[],
  options: SyncPartnersOptions = {}
): PartnerInstance[] | undefined {
  const { reseedLoadout = false, mintId = () => crypto.randomUUID() } = options
  const current = existing ?? []

  const unclaimed = [...current]
  const claim = (seed: PartnerSeed): PartnerInstance | undefined => {
    const index = unclaimed.findIndex((partner) => matchesSeed(partner, seed))
    if (index === -1) return undefined
    const [claimed] = unclaimed.splice(index, 1)
    return claimed
  }

  // Two passes: every seed claims an existing instance BEFORE any seed mints a
  // new one. A single pass would let an unnamed seed claim the instance a named
  // seed needed, renaming a drone the player had already customised.
  const claimed = seeds.map((seed) => ({ seed, instance: claim(seed) }))

  const next = claimed.map(({ seed, instance }) => {
    if (!instance) return newInstance(seed, mintId())
    if (!reseedLoadout) return instance
    return {
      ...instance,
      // The seed owns the LOADOUT; the instance owns everything lived-in.
      systems: [...seed.systems],
      modules: [...seed.modules],
      ...(seed.name !== undefined ? { name: seed.name } : {}),
    }
  })

  if (next.length === 0) return current.length === 0 ? undefined : []
  return next
}
