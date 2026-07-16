import type { SURefEntity, SURefMetaEntity, SURefObjectPattern } from 'salvageunion-reference'
import { SalvageUnionReference, resolveGrantedEntities } from 'salvageunion-reference'

/** A single embedded chassis-ability object may name a drone configuration. */
type ChassisAbilityLike = { drone?: unknown }
/** A crawler/bay carries its commander as an embedded npc object. */
type EmbeddedNpc = { name?: unknown; position?: unknown }

/** A labelled group of nested entities — rendered as a `Slab` separator + a
 * grid of depth+1 cards. */
export type NEWNestedGroup = {
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
export function resolveNestedEntities(entity: SURefMetaEntity): NEWNestedGroup[] {
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
export function resolvePatternGroups(pattern: SURefObjectPattern): NEWNestedGroup[] {
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
