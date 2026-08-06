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
 * ── The two hosts reconcile differently, and the asymmetry is the rules ──────
 *
 * A MECH's roster is EXACT. The pattern says how many drones are fielded and
 * what each carries (Big Brother's DronTek fields four), so a pattern change
 * rewrites the roster and each drone's loadout, exactly as the mech wizard
 * already rewrites the mech's own systems/modules from the pattern.
 *
 * A PILOT's roster is ADDITIVE. `pilot.equipment` records WHICH stat blocks are
 * granted but not how many: Mecha Packmaster (p. 69) raises the Mecha Companion
 * cap to two off a second ability while the equipment slug stays singular. So an
 * equipment slug that is gone takes its partners with it, and a slug that is
 * present gets at least one — but a surplus instance is left alone rather than
 * reaped, because this module cannot prove it was not legitimately fielded.
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
 * Whether an equipment slug carries a mech-shaped stat block, i.e. whether
 * equipping it grants a partner. Derived from the data rather than hardcoded:
 * `systemSlots` is what separates Auto-Turret / Survey Drone / Mecha Companion
 * from every other piece of gear, and a fourth such record should light this up
 * without an edit here.
 *
 * Requires `equipment` preloaded.
 */
export function isPartnerEquipment(slug: string): boolean {
  return (
    SalvageUnionReference.Equipment.find(
      (entry) =>
        matchesRef(entry, slug) &&
        typeof (entry as { systemSlots?: unknown }).systemSlots === 'number'
    ) !== undefined
  )
}

/**
 * One seed per partner-granting equipment slug the pilot has equipped.
 *
 * The equipment records carry no `systems`/`modules` of their own, so these
 * seeds are always bare — a pilot's partner starts empty and is kitted out in
 * play, unlike a mech's, which arrives wearing its pattern.
 */
export function pilotPartnerSeeds(equipment: readonly string[]): PartnerSeed[] {
  return equipment.filter(isPartnerEquipment).map((slug) => ({
    hostRef: slug,
    hostSchema: 'equipment' as const,
    systems: [],
    modules: [],
  }))
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
   * EXACT (mech): the seed list is the whole roster — surplus instances of a
   * granted stat block are dropped, and every kept instance has its loadout
   * rewritten from its seed.
   *
   * ADDITIVE (pilot, the default): a granted stat block keeps whatever
   * instances it has, and loadouts are never touched.
   */
  exact?: boolean
  /** Injectable for deterministic tests. */
  mintId?: () => string
}

/**
 * Reconcile a host's `partners` against what it currently grants.
 *
 * Live state is never collateral damage: a matched instance keeps its id,
 * structure, energy, heat, conditions, name, appearance, A.I. personality and
 * cargo. In `exact` mode its `systems`/`modules` are re-seeded — the mech wizard
 * already rewrites the mech's own loadout from the pattern on every save, and a
 * drone that kept a previous pattern's guns would be the odd one out.
 *
 * Returns `undefined` when the host has, and should have, no partners, so the
 * field stays absent rather than persisting an empty array.
 */
export function syncPartners(
  existing: readonly PartnerInstance[] | undefined,
  seeds: readonly PartnerSeed[],
  options: SyncPartnersOptions = {}
): PartnerInstance[] | undefined {
  const { exact = false, mintId = () => crypto.randomUUID() } = options
  const current = existing ?? []

  const unclaimed = [...current]
  const claim = (seed: PartnerSeed): PartnerInstance | undefined => {
    const index = unclaimed.findIndex((partner) => matchesSeed(partner, seed))
    if (index === -1) return undefined
    const [claimed] = unclaimed.splice(index, 1)
    return claimed
  }

  const next = seeds.map((seed) => {
    const claimed = claim(seed)
    if (!claimed) return newInstance(seed, mintId())
    if (!exact) return claimed
    return {
      ...claimed,
      // The seed owns the LOADOUT; the instance owns everything lived-in.
      systems: [...seed.systems],
      modules: [...seed.modules],
      ...(seed.name !== undefined ? { name: seed.name } : {}),
    }
  })

  if (!exact) {
    // Additive: anything left over survives if its grant is still present.
    // Only an ungranted stat block is reaped.
    const grantedRefs = new Set(seeds.map((seed) => seed.hostRef))
    next.push(...unclaimed.filter((partner) => grantedRefs.has(partner.hostRef)))
  }

  if (next.length === 0) return current.length === 0 ? undefined : []
  return next
}
