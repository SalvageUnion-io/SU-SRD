import type { SURefEntity, SURefMetaEntity, SURefObjectPattern } from 'salvageunion-reference'
import {
  getChassisAbilities,
  resolveGrantedEntities,
  SalvageUnionReference,
} from 'salvageunion-reference'

/** A labelled group of nested entities — rendered as a `Slab` separator + a
 * grid of depth+1 cards. */
export type NestedGroup = {
  label: string
  entities: SURefEntity[]
}

/**
 * Resolve every NESTED reference entity a card surfaces, GROUPED for the body's
 * `Slab`-separated sections — the single collection point so nested entities
 * always route back through the unified NEW card (never the legacy path):
 *
 * - **Grants** — `resolveGrantedEntities` (ability-granted equipment/drones/…).
 * - **Drones** — chassis-ability drones (object-shaped abilities naming a drone).
 * - **NPCs** — a crawler's embedded commander, synthesized into an npcs-schema
 *   entity so it renders through this same card.
 *
 * Chassis PATTERNS are handled separately: the basic chassis renders a pattern
 * LIST, and a single pattern's loadout comes from `resolvePatternGroups`.
 *
 * De-duplicated globally by `schemaName:id` (patterns reuse systems across
 * loadouts). Actions are NOT here — they render as their own rust cards.
 */
export function resolveNestedEntities(entity: SURefMetaEntity): NestedGroup[] {
  const groups = new Map<string, SURefEntity[]>()
  const seen = new Set<string>()

  const push = (label: string, candidate: SURefEntity | undefined): void => {
    if (!candidate) return
    const schema =
      'schemaName' in candidate && typeof candidate.schemaName === 'string'
        ? candidate.schemaName
        : ''
    const id = 'id' in candidate && typeof candidate.id === 'string' ? candidate.id : ''
    const name = 'name' in candidate && typeof candidate.name === 'string' ? candidate.name : ''
    const key = `${schema}:${id || name}`
    if (seen.has(key)) return
    seen.add(key)
    const bucket = groups.get(label)
    if (bucket) bucket.push(candidate)
    else groups.set(label, [candidate])
  }

  // 1. Universal grant walk (single source of truth).
  for (const granted of resolveGrantedEntities(entity as SURefEntity)) push('Grants', granted)

  // NOTE: chassis PATTERNS are NOT expanded into Systems/Modules here — the basic
  // chassis card shows a pattern LIST, and the per-pattern loadout is a separate
  // rendering (`resolvePatternGroups`, the pattern view).

  // 2. Chassis-ability drones (object-shaped abilities naming a drone).
  if ('chassisAbilities' in entity && Array.isArray(entity.chassisAbilities)) {
    for (const ability of entity.chassisAbilities) {
      if (typeof ability !== 'object' || ability === null || !('drone' in ability)) continue
      const { drone } = ability
      if (typeof drone === 'string') {
        push('Drones', SalvageUnionReference.getByNameIn('drones', drone))
      }
    }
  }

  // 3. Crawler commander NPC — the embedded npc object, synthesized into an
  // npcs-schema entity so it routes through the same card (npc/monster tone).
  if ('npc' in entity && entity.npc && typeof entity.npc === 'object') {
    const embedded = entity.npc
    const npcName =
      'name' in embedded && typeof embedded.name === 'string'
        ? embedded.name
        : 'position' in embedded && typeof embedded.position === 'string'
          ? embedded.position
          : undefined
    if (npcName) {
      // Deliberate serialization-boundary cast: the embedded crawler-commander
      // object (position/hitPoints/…) is NOT a full npcs-schema entity (no
      // id/source/page), so no honest single cast exists — the card renders
      // it defensively by data-shape checks.
      const synthesized = {
        ...embedded,
        name: npcName,
        schemaName: 'npcs',
      } as unknown as SURefEntity
      push('NPCs', synthesized)
    }
  }

  return [...groups.entries()].map(([label, entities]) => ({ label, entities }))
}

/**
 * A single pattern's loadout, grouped for the PATTERN view: its `systems` and
 * `modules` (and any named `drones`), resolved by name into real reference
 * entities. Rendered as `Slab`-separated masonry groups of compact cards under
 * the pattern (with the chassis name as a seam stampseal).
 *
 * MULTIPLICITY IS PRESERVED — one card per installed copy, matching the printed
 * pattern block (Atlas's Thunder Storm reads ".50 Cal Machine Gun x6") and the
 * wizard's own expansion in `useChassisPatternConfig`.
 *
 * This function used to de-duplicate by `label:schema:id`, which silently
 * collapsed every multiple in the SRD pattern view — 60 of 209 patterns, so
 * Leviathan's Destroyer showed one .50 Cal instead of six, one Red Laser
 * instead of three, one 30mm Autocannon instead of two. It also swallowed the
 * OTHER way the data spells a multiple: Trooper's DronTek pattern repeats
 * `Articulated Rigging Arm` and `Chaff Launcher` as separate entries with no
 * `count`, so both spellings have to survive the walk.
 *
 * Duplicate cards are safe to render: the card's `cardKey` disambiguates by
 * index, not by entity id.
 */
export function resolvePatternGroups(pattern: SURefObjectPattern): NestedGroup[] {
  const groups = new Map<string, SURefEntity[]>()

  // `count` defaults to 1 when ABSENT, but an explicit 0 renders nothing — the
  // schema permits it (`NonNegativeIntegerSchema`) and "zero installed" is the
  // only honest reading. Clamping it up to 1 would invent a card the loadout
  // does not claim, and would disagree with `useChassisPatternConfig`, which
  // this function is otherwise kept in step with.
  const push = (label: string, candidate: SURefEntity | undefined, count = 1): void => {
    if (!candidate) return
    const copies = Array.from({ length: count }, () => candidate)
    if (copies.length === 0) return
    const bucket = groups.get(label)
    if (bucket) bucket.push(...copies)
    else groups.set(label, copies)
  }

  for (const s of pattern.systems ?? [])
    push('Systems', SalvageUnionReference.getByNameIn('systems', s.name), s.count)
  for (const m of pattern.modules ?? [])
    push('Modules', SalvageUnionReference.getByNameIn('modules', m.name), m.count)
  for (const d of pattern.drones ?? [])
    push(
      'Drones',
      // `ref ?? name` — an instance name ('Shield Drone') resolves through its
      // shared stat block ('Big Brother Drone'). See `resolvePatternDrones`.
      SalvageUnionReference.getByNameIn('drones', d.ref ?? d.name)
    )

  return [...groups.entries()].map(([label, entities]) => ({ label, entities }))
}

/** A drone plus its resolved systems/modules loadout — rendered as a compact
 * drone card with listing rows for its systems + modules. */
export type DroneLoadout = {
  drone: SURefEntity
  systems: SURefEntity[]
  modules: SURefEntity[]
  /**
   * The name this pattern gives THIS drone, when it differs from the stat
   * block's own name. Big Brother's DronTek pattern fields four Big Brother
   * Drones called Shield / Anti-Missile / Fire Support / Minelayer Drone, so
   * without this they would all render as four identical "Big Brother Drone"
   * cards. Absent when the config names the stat block directly.
   */
  instanceName?: string
}

function resolveLoadout(
  systemNames: string[],
  moduleNames: string[]
): { systems: SURefEntity[]; modules: SURefEntity[] } {
  const systems = systemNames.flatMap((name) => {
    const found = SalvageUnionReference.getByNameIn('systems', name)
    return found ? [found] : []
  })
  const modules = moduleNames.flatMap((name) => {
    const found = SalvageUnionReference.getByNameIn('modules', name)
    return found ? [found] : []
  })
  return { systems, modules }
}

/** The drone a CHASSIS controls — named by a chassis ability's `drone` field;
 * its systems/modules come from the drone entity's own loadout. */
export function resolveChassisDrone(entity: SURefMetaEntity): DroneLoadout | undefined {
  const abilities = getChassisAbilities(entity) ?? []
  const droneName = abilities
    .map((ability) => (ability as { drone?: unknown }).drone)
    .find((d): d is string => typeof d === 'string')
  if (!droneName) return undefined
  const drone = SalvageUnionReference.getByNameIn('drones', droneName)
  if (!drone) return undefined
  const droneSystems = Array.isArray(drone.systems) ? drone.systems : []
  const droneModules = Array.isArray(drone.modules) ? drone.modules : []
  return { drone, ...resolveLoadout(droneSystems, droneModules) }
}

/**
 * EVERY drone a PATTERN fields — each with its own name and loadout.
 *
 * Plural because patterns are: Little Sestra's three patterns ship one Sestra
 * Drone each, but Big Brother's DronTek pattern ships FOUR. This used to read
 * `pattern.drones[0]` and returned a single loadout, which silently dropped
 * three of Big Brother's four.
 *
 * A config's stat block is `ref ?? name` — `ref` is what lets an instance name
 * ("Shield Drone") sit over a shared stat block ("Big Brother Drone"). Configs
 * that resolve to nothing are skipped rather than failing the whole pattern.
 */
export function resolvePatternDrones(pattern: SURefObjectPattern): DroneLoadout[] {
  return (pattern.drones ?? []).flatMap((config) => {
    const statBlockName = config.ref ?? config.name
    const drone = SalvageUnionReference.getByNameIn('drones', statBlockName)
    if (!drone) return []
    return [
      {
        drone,
        ...resolveLoadout(config.systems ?? [], config.modules ?? []),
        ...(config.ref ? { instanceName: config.name } : {}),
      },
    ]
  })
}

/** A drone's OWN systems/modules loadout (from its `systems`/`modules` name
 * arrays) — used when a drone card renders standalone (no pattern override). */
export function resolveDroneOwnLoadout(entity: SURefMetaEntity): {
  systems: SURefEntity[]
  modules: SURefEntity[]
} {
  const names = (value: unknown): string[] =>
    Array.isArray(value) ? value.filter((n): n is string => typeof n === 'string') : []
  return resolveLoadout(
    names('systems' in entity ? entity.systems : undefined),
    names('modules' in entity ? entity.modules : undefined)
  )
}
