import type { SURefEntity, SURefMetaEntity, SURefObjectPattern } from 'salvageunion-reference'
import {
  SalvageUnionReference,
  getChassisAbilities,
  resolveGrantedEntities,
} from 'salvageunion-reference'

/** A single embedded chassis-ability object may name a drone configuration. */
type ChassisAbilityLike = { drone?: unknown }
/** A crawler/bay carries its commander as an embedded npc object. */
type EmbeddedNpc = { name?: unknown; position?: unknown }

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

  // 2. Chassis-ability drones.
  if ('chassisAbilities' in entity && Array.isArray(entity.chassisAbilities)) {
    for (const ability of entity.chassisAbilities as ChassisAbilityLike[]) {
      if (typeof ability.drone === 'string') {
        const droneName = ability.drone
        push(
          'Drones',
          SalvageUnionReference.findIn('drones', (x) => x.name === droneName)
        )
      }
    }
  }

  // 3. Crawler commander NPC — the embedded npc object, synthesized into an
  // npcs-schema entity so it routes through the same card (npc/monster tone).
  if ('npc' in entity && entity.npc && typeof entity.npc === 'object') {
    const embedded = entity.npc as EmbeddedNpc
    const npcName =
      typeof embedded.name === 'string'
        ? embedded.name
        : typeof embedded.position === 'string'
          ? embedded.position
          : undefined
    if (npcName) {
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
 * entities and de-duplicated. Rendered as `Slab`-separated masonry groups of
 * compact cards under the pattern (with the chassis name as a seam stampseal).
 */
export function resolvePatternGroups(pattern: SURefObjectPattern): NestedGroup[] {
  const groups = new Map<string, SURefEntity[]>()
  const seen = new Set<string>()

  const push = (label: string, candidate: SURefEntity | undefined): void => {
    if (!candidate) return
    const id = 'id' in candidate && typeof candidate.id === 'string' ? candidate.id : ''
    const name = 'name' in candidate && typeof candidate.name === 'string' ? candidate.name : ''
    const schema =
      'schemaName' in candidate && typeof candidate.schemaName === 'string'
        ? candidate.schemaName
        : ''
    const key = `${label}:${schema}:${id || name}`
    if (seen.has(key)) return
    seen.add(key)
    const bucket = groups.get(label)
    if (bucket) bucket.push(candidate)
    else groups.set(label, [candidate])
  }

  for (const s of pattern.systems ?? [])
    push(
      'Systems',
      SalvageUnionReference.findIn('systems', (x) => x.name === s.name)
    )
  for (const m of pattern.modules ?? [])
    push(
      'Modules',
      SalvageUnionReference.findIn('modules', (x) => x.name === m.name)
    )
  for (const d of pattern.drones ?? [])
    push(
      'Drones',
      SalvageUnionReference.findIn('drones', (x) => x.name === d.name)
    )

  return [...groups.entries()].map(([label, entities]) => ({ label, entities }))
}

/** A drone plus its resolved systems/modules loadout — rendered as a compact
 * drone card with listing rows for its systems + modules. */
export type DroneLoadout = {
  drone: SURefEntity
  systems: SURefEntity[]
  modules: SURefEntity[]
}

function resolveLoadout(
  drone: SURefEntity,
  systemNames: string[],
  moduleNames: string[]
): DroneLoadout {
  const systems = systemNames.flatMap((name) => {
    const found = SalvageUnionReference.findIn('systems', (s) => s.name === name)
    return found ? [found] : []
  })
  const modules = moduleNames.flatMap((name) => {
    const found = SalvageUnionReference.findIn('modules', (m) => m.name === name)
    return found ? [found] : []
  })
  return { drone, systems, modules }
}

/** The drone a CHASSIS controls — named by a chassis ability's `drone` field;
 * its systems/modules come from the drone entity's own loadout. */
export function resolveChassisDrone(entity: SURefMetaEntity): DroneLoadout | undefined {
  const abilities = getChassisAbilities(entity) ?? []
  const droneName = abilities
    .map((ability) => (ability as { drone?: unknown }).drone)
    .find((d): d is string => typeof d === 'string')
  if (!droneName) return undefined
  const drone = SalvageUnionReference.findIn('drones', (d) => d.name === droneName)
  if (!drone) return undefined
  const droneSystems = Array.isArray(drone.systems) ? drone.systems : []
  const droneModules = Array.isArray(drone.modules) ? drone.modules : []
  return resolveLoadout(drone, droneSystems, droneModules)
}

/** The drone a PATTERN specifies — named + loadout come from `pattern.drones[0]`. */
export function resolvePatternDrone(pattern: SURefObjectPattern): DroneLoadout | undefined {
  const config = pattern.drones?.[0]
  if (!config) return undefined
  const drone = SalvageUnionReference.findIn('drones', (d) => d.name === config.name)
  if (!drone) return undefined
  return resolveLoadout(drone, config.systems ?? [], config.modules ?? [])
}

/** A drone's OWN systems/modules loadout (from its `systems`/`modules` name
 * arrays) — used when a drone card renders standalone (no pattern override). */
export function resolveDroneOwnLoadout(entity: SURefMetaEntity): {
  systems: SURefEntity[]
  modules: SURefEntity[]
} {
  const names = (key: 'systems' | 'modules'): string[] => {
    const value = (entity as Record<string, unknown>)[key]
    return Array.isArray(value) ? value.filter((n): n is string => typeof n === 'string') : []
  }
  const { systems, modules } = resolveLoadout(
    entity as SURefEntity,
    names('systems'),
    names('modules')
  )
  return { systems, modules }
}
