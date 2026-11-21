/**
 * Changing a mech's chassis: the loadout goes with it where it fits. Systems
 * and Modules are kept in their installed order while the new chassis has the
 * slots for them (`computeMechCapacity`, so a chassis's own budget rules
 * count); what would overfill it is left off and named, never silently lost.
 */

import {
  computeMechCapacity,
  resolveModuleRef,
  resolveSystemRef,
} from 'salvageunion-reference/rules'

export type ChassisSwap = {
  systems: string[]
  modules: string[]
  /** The refs left off, systems then modules, in their installed order. */
  dropped: string[]
}

export function loadoutOnChassis(
  chassisRef: string,
  loadout: { systems: readonly string[]; modules: readonly string[] }
): ChassisSwap {
  const systems: string[] = []
  const modules: string[] = []
  const dropped: string[] = []
  const fits = (next: { systems: string[]; modules: string[] }) => {
    const capacity = computeMechCapacity({
      chassisRef,
      systems: next.systems.map((ref) => ({ ref })),
      modules: next.modules.map((ref) => ({ ref })),
    })
    return (
      capacity.systemSlotsUsed <= capacity.systemSlotsMax &&
      capacity.moduleSlotsUsed <= capacity.moduleSlotsMax
    )
  }
  for (const ref of loadout.systems) {
    if (fits({ systems: [...systems, ref], modules })) systems.push(ref)
    else dropped.push(ref)
  }
  for (const ref of loadout.modules) {
    if (fits({ systems, modules: [...modules, ref] })) modules.push(ref)
    else dropped.push(ref)
  }
  return { systems, modules, dropped }
}

/** The left-off parts by name, copies counted (`Red Laser ×2`), for the player to read. */
export function droppedNames(dropped: readonly string[]): string[] {
  const counts = new Map<string, number>()
  for (const ref of dropped) {
    const name = (resolveSystemRef(ref) ?? resolveModuleRef(ref))?.name ?? ref
    counts.set(name, (counts.get(name) ?? 0) + 1)
  }
  return [...counts.entries()].map(([name, count]) => (count > 1 ? `${name} ×${count}` : name))
}
