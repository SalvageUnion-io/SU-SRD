import { SalvageUnionReference } from 'salvageunion-reference'
import type {
  SURefEntity,
  SURefSystem,
  SURefModule,
  EntitySchemaName,
} from 'salvageunion-reference'
import type { ResolvedItem, CapacityInfo } from './builderUtils'
import type { EntityRefRow } from '../types/common'

/** Metadata key used to tag entity_refs belonging to a sub-entity's modification slots */
const SLOT_OWNER_KEY = 'slot_owner_ref'

/**
 * Returns true if an entity has modification slots (systemSlots > 0 or moduleSlots > 0).
 * Uses duck-typing so it works with any entity shape (drones, equipment, etc.).
 */
export function hasModificationSlots(entity: Record<string, unknown>): boolean {
  const sys = typeof entity.systemSlots === 'number' ? entity.systemSlots : 0
  const mod = typeof entity.moduleSlots === 'number' ? entity.moduleSlots : 0
  return sys > 0 || mod > 0
}

/**
 * Returns true if an entity_ref is a sub-entity modification (has metadata.slot_owner_ref).
 */
export function isSlotOwnerRef(ref: EntityRefRow): boolean {
  if (!ref.metadata || typeof ref.metadata !== 'object') return false
  const meta = ref.metadata as Record<string, unknown>
  return typeof meta[SLOT_OWNER_KEY] === 'string'
}

/**
 * Filter entity refs to those belonging to a specific slot owner entity.
 */
export function getSlotOwnerRefs(mechRefs: EntityRefRow[], ownerEntityId: string): EntityRefRow[] {
  return mechRefs.filter((ref) => {
    if (ref.schema_name !== 'systems' && ref.schema_name !== 'modules') return false
    if (!ref.metadata || typeof ref.metadata !== 'object') return false
    const meta = ref.metadata as Record<string, unknown>
    return meta[SLOT_OWNER_KEY] === ownerEntityId
  })
}

/**
 * Resolve an entity's built-in systems (from `entity.systems: string[]`) to ResolvedItem[].
 * Uses negative sort_order values to distinguish from player-added items.
 */
export function resolveBuiltInSystems(entity: SURefEntity): ResolvedItem[] {
  if (!('systems' in entity) || !Array.isArray(entity.systems)) return []

  const builtIn: ResolvedItem[] = []
  for (let i = 0; i < entity.systems.length; i++) {
    const name = entity.systems[i]
    const resolved = SalvageUnionReference.Systems.find((s) => s.name === name)
    if (!resolved) continue
    builtIn.push({
      schema_name: 'systems',
      schema_ref_id: resolved.id,
      sort_order: -(i + 1),
      entity: resolved,
    })
  }

  return builtIn
}

/**
 * Compute capacity info for an entity's modification slots.
 */
export function computeSlotCapacity(
  entity: SURefEntity,
  _builtInItems: ResolvedItem[],
  playerItems: ResolvedItem[]
): CapacityInfo {
  const systemSlotsTotal =
    'systemSlots' in entity && typeof entity.systemSlots === 'number' ? entity.systemSlots : 0
  const moduleSlotsTotal =
    'moduleSlots' in entity && typeof entity.moduleSlots === 'number' ? entity.moduleSlots : 0

  let systemSlotsUsed = 0
  let moduleSlotsUsed = 0

  // Only count player-added items — built-in (integrated) systems are free
  for (const item of playerItems) {
    const slots = item.entity.slotsRequired ?? 1
    if (item.schema_name === 'systems') {
      systemSlotsUsed += slots
    } else {
      moduleSlotsUsed += slots
    }
  }

  const isOverSystemCapacity = systemSlotsUsed > systemSlotsTotal
  const isOverModuleCapacity = moduleSlotsUsed > moduleSlotsTotal

  return {
    systemSlotsUsed,
    systemSlotsTotal,
    moduleSlotsUsed,
    moduleSlotsTotal,
    isOverSystemCapacity,
    isOverModuleCapacity,
    isValid: !isOverSystemCapacity && !isOverModuleCapacity,
  }
}

/**
 * Returns metadata object for a slot-owner modification entity_ref.
 */
export function slotOwnerMetadata(ownerEntityId: string): Record<string, string> {
  return { [SLOT_OWNER_KEY]: ownerEntityId }
}

/**
 * Resolve player-added entity refs to ResolvedItem[].
 */
export function resolvePlayerItems(refs: EntityRefRow[]): ResolvedItem[] {
  const resolved: ResolvedItem[] = []
  for (const ref of refs) {
    const entity = SalvageUnionReference.get(
      ref.schema_name as EntitySchemaName,
      ref.schema_ref_id
    ) as SURefSystem | SURefModule | undefined
    if (entity) {
      resolved.push({
        schema_name: ref.schema_name as 'systems' | 'modules',
        schema_ref_id: ref.schema_ref_id,
        sort_order: ref.sort_order,
        entity,
      })
    }
  }
  return resolved
}
