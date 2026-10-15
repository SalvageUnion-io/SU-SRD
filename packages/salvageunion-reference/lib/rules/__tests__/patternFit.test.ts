/**
 * Every printed mech pattern fits its chassis — or is listed, with its page,
 * in `AS_PRINTED_OVERFLOW` as one the book itself prints over its slots.
 *
 * Real data: the point is to catch a pattern, a chassis's slots or an item's
 * `slotsRequired` that changes so a pattern no longer fits (or now does).
 */
import { describe, expect, it } from 'bun:test'
import { SalvageUnionReference } from '../../index'
import { nameToSlug } from '../../nameToSlug'
import type { SURefChassis, SURefObjectPattern } from '../../schemas/index'
import { AS_PRINTED_OVERFLOW } from '../capacity'
import { resolveModuleRef, resolveSystemRef } from '../resolveRefs'

/** One mount's slot usage: the chassis itself (`head` absent) or one of its heads. */
type MountSlotUsage = {
  head?: string
  systemSlotsUsed: number
  systemSlotsMax: number
  moduleSlotsUsed: number
  moduleSlotsMax: number
}

/**
 * A pattern's slot usage per mount: the chassis first, then each of its heads.
 * Items are costed by the reference's `slotsRequired` (1 when unresolved, as in
 * `computeMechCapacity`) times their `count`. An item placed on a head the
 * chassis does not have gets a mount of its own with no slots.
 */
function patternSlotUsage(chassis: SURefChassis, pattern: SURefObjectPattern): MountSlotUsage[] {
  const mounts: MountSlotUsage[] = [
    {
      systemSlotsUsed: 0,
      systemSlotsMax: chassis.systemSlots,
      moduleSlotsUsed: 0,
      moduleSlotsMax: chassis.moduleSlots,
    },
    ...(chassis.heads ?? []).map((head) => ({
      head: head.name,
      systemSlotsUsed: 0,
      systemSlotsMax: head.systemSlots,
      moduleSlotsUsed: 0,
      moduleSlotsMax: head.moduleSlots,
    })),
  ]
  const mountFor = (head: string | undefined): MountSlotUsage => {
    const found = mounts.find((mount) => mount.head === head)
    if (found) return found
    const added = {
      head,
      systemSlotsUsed: 0,
      systemSlotsMax: 0,
      moduleSlotsUsed: 0,
      moduleSlotsMax: 0,
    }
    mounts.push(added)
    return added
  }
  for (const item of pattern.systems) {
    mountFor(item.head).systemSlotsUsed +=
      (resolveSystemRef(nameToSlug(item.name))?.slotsRequired ?? 1) * (item.count ?? 1)
  }
  for (const item of pattern.modules) {
    mountFor(item.head).moduleSlotsUsed +=
      (resolveModuleRef(nameToSlug(item.name))?.slotsRequired ?? 1) * (item.count ?? 1)
  }
  return mounts
}

/** True when every mount's usage is within its slots. */
function mountsFit(mounts: readonly MountSlotUsage[]): boolean {
  return mounts.every(
    (mount) =>
      mount.systemSlotsUsed <= mount.systemSlotsMax && mount.moduleSlotsUsed <= mount.moduleSlotsMax
  )
}

const chassisList = SalvageUnionReference.Chassis.all()

// Hidden patterns too: they are records, and the Cantina can still hold a mech built
// from one before it was hidden.
const patterns = chassisList.flatMap((chassis) =>
  chassis.patterns.map((pattern) => ({ chassis, pattern }))
)

const key = (chassis: string, pattern: string) => `${chassis} / ${pattern}`
const allowed = new Map(
  AS_PRINTED_OVERFLOW.map((entry) => [key(entry.chassis, entry.pattern), entry])
)

describe('every pattern fits its chassis, or is printed over it', () => {
  it.each(
    patterns.map(({ chassis, pattern }) => [key(chassis.name, pattern.name), chassis, pattern])
  )('%s', (name, chassis, pattern) => {
    const fits = mountsFit(patternSlotUsage(chassis, pattern))
    // An overflow must be listed; a listed pattern must still overflow.
    expect({ name, fits }).toEqual({ name, fits: !allowed.has(name) })
  })
})

describe('AS_PRINTED_OVERFLOW', () => {
  it('lists each pattern once', () => {
    expect(allowed.size).toBe(AS_PRINTED_OVERFLOW.length)
  })

  it('names patterns that exist', () => {
    const existing = new Set(
      patterns.map(({ chassis, pattern }) => key(chassis.name, pattern.name))
    )
    expect([...allowed.keys()].filter((name) => !existing.has(name))).toEqual([])
  })

  it('cites a page for every entry', () => {
    expect(AS_PRINTED_OVERFLOW.filter((entry) => !/ p\.\d+$/.test(entry.cite))).toEqual([])
  })

  it('holds no legal starting pattern (the creation wizard prefills those)', () => {
    const legal = patterns
      .filter(
        ({ chassis, pattern }) =>
          pattern.legalStarting && allowed.has(key(chassis.name, pattern.name))
      )
      .map(({ chassis, pattern }) => key(chassis.name, pattern.name))
    expect(legal).toEqual([])
  })
})

describe('chassis heads', () => {
  it('every pattern item placed on a head names one of its chassis heads', () => {
    const stray = patterns.flatMap(({ chassis, pattern }) => {
      const heads = new Set((chassis.heads ?? []).map((head) => head.name))
      return [...pattern.systems, ...pattern.modules]
        .filter((item) => item.head !== undefined && !heads.has(item.head))
        .map((item) => `${key(chassis.name, pattern.name)}: ${item.name} on ${item.head}`)
    })
    expect(stray).toEqual([])
  })

  it('TAC-OS mounts its loadout on the Cerberus heads as printed (Rainmaker p.72–75)', () => {
    const cerberus = SalvageUnionReference.Chassis.getBySlug('cerberus')
    const tacOs = cerberus?.patterns.find((p) => p.name === 'TAC-OS')
    if (!cerberus || !tacOs) throw new Error('Cerberus TAC-OS is missing from the data')
    expect(patternSlotUsage(cerberus, tacOs)).toEqual([
      { systemSlotsUsed: 6, systemSlotsMax: 5, moduleSlotsUsed: 2, moduleSlotsMax: 2 },
      {
        head: 'Kyrios',
        systemSlotsUsed: 15,
        systemSlotsMax: 15,
        moduleSlotsUsed: 2,
        moduleSlotsMax: 2,
      },
      {
        head: 'Phren',
        systemSlotsUsed: 9,
        systemSlotsMax: 9,
        moduleSlotsUsed: 4,
        moduleSlotsMax: 4,
      },
      {
        head: 'Morphos',
        systemSlotsUsed: 13,
        systemSlotsMax: 12,
        moduleSlotsUsed: 2,
        moduleSlotsMax: 3,
      },
    ])
  })

  it('puts an item on an unknown head on a mount with no slots', () => {
    const mule = SalvageUnionReference.Chassis.getBySlug('mule')
    if (!mule) throw new Error('Mule is missing from the data')
    const usage = patternSlotUsage(mule, {
      name: 'Stray',
      systems: [{ name: 'Escape Hatch', head: 'Nowhere' }],
      modules: [],
    })
    expect(usage.at(-1)).toEqual({
      head: 'Nowhere',
      systemSlotsUsed: 1,
      systemSlotsMax: 0,
      moduleSlotsUsed: 0,
      moduleSlotsMax: 0,
    })
    expect(mountsFit(usage)).toBe(false)
  })
})
