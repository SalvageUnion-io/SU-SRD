/**
 * What a downed Opposition leaves to salvage (Core Book pp.245–246, 248).
 *
 *  - **A Mech** is salvaged on the Mech Salvage table: its Chassis, and the
 *    Systems and Modules its pattern mounts, each at its own Tech Level and
 *    Salvage Value (`WreckPart`).
 *  - **A Vehicle** is scrapped for its Salvage Value in Scrap of its Tech
 *    Level (p.246). Which of its Systems or Modules can be salvaged is the
 *    Mediator's call, so none is offered here.
 *  - Everything else (NPCs, squads, creatures, Bio-Titans, Meld) leaves no
 *    salvage the rules price in Scrap of Tech 1–6.
 *
 * Pure: the caller reads the entity and the items its pattern mounts from the
 * reference.
 */

import { nameToSlug } from 'salvageunion-reference'

/** One part of a downed mech: its Chassis, or a System or Module it mounted. */
export type WreckPart = {
  key: string
  kind: 'chassis' | 'system' | 'module'
  name: string
  /** Numeric TL 1–6 when known: the Scrap a 2–5 pays is of the Chassis's. */
  techLevel?: number
  salvageValue: number
}

export type Wreck =
  | { kind: 'mech'; parts: WreckPart[] }
  | { kind: 'scrap'; techLevel: number; salvageValue: number }

/** A System or Module a mech's pattern mounts, as printed, and its reference record. */
export type MountedItem = {
  kind: 'system' | 'module'
  name: string
  item: Record<string, unknown> | null
}

/** The Tech Levels Scrap is kept in: Tech 1 to 6. */
const SCRAP_TIERS = { low: 1, high: 6 } as const

/** A Tech Level the scrap pool has a bucket for, or undefined. */
function tierOf(value: unknown): number | undefined {
  return typeof value === 'number' &&
    Number.isInteger(value) &&
    value >= SCRAP_TIERS.low &&
    value <= SCRAP_TIERS.high
    ? value
    : undefined
}

function salvageValueOf(value: unknown): number {
  return typeof value === 'number' && value > 0 ? value : 0
}

/**
 * The salvage a downed unit leaves, or null when it leaves none: a Vehicle's
 * Scrap, or a Mech's Chassis and the items it mounted (`mounted`, in pattern
 * order).
 */
export function wreckOf(
  refSchema: string | null,
  entity: Record<string, unknown> | null,
  mounted: readonly MountedItem[]
): Wreck | null {
  if (entity === null) return null
  if (refSchema === 'vehicles') {
    const techLevel = tierOf(entity.techLevel)
    const salvageValue = salvageValueOf(entity.salvageValue)
    return techLevel === undefined || salvageValue === 0
      ? null
      : { kind: 'scrap', techLevel, salvageValue }
  }
  if (refSchema !== 'chassis') return null
  const parts: WreckPart[] = [
    {
      key: 'chassis',
      kind: 'chassis',
      name: String(entity.name ?? 'Chassis'),
      techLevel: tierOf(entity.techLevel),
      salvageValue: salvageValueOf(entity.salvageValue),
    },
  ]
  const seen = { system: 0, module: 0 }
  for (const { kind, name, item } of mounted) {
    const i = seen[kind]++
    parts.push({
      key: `${kind}:${i}:${nameToSlug(name)}`,
      kind,
      name: typeof item?.name === 'string' ? item.name : name,
      techLevel: tierOf(item?.techLevel),
      salvageValue: salvageValueOf(item?.salvageValue),
    })
  }
  return { kind: 'mech', parts }
}
