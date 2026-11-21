/**
 * The Mechs shelf's build figures and its sort: what tells two builds on one
 * chassis apart (Tech Level, slots filled, Scrap), read off the mech, and the
 * order a pressed column puts the rows in.
 */
import type { Mech } from 'game-domain/schemas/mech'
import { computeMechCapacity, resolveChassisRef } from 'salvageunion-reference/rules'
import type { LedgerSort } from '../../components/index'
import { readReference } from '../../lib/readReference'
import { mechScrap } from '../../lib/rules/mechScrap'

export type MechBuildFigures = {
  /** The chassis's Tech Level; none without a chassis. */
  techLevel: number | string | undefined
  /** Slots filled of the chassis's (`12/12`); `''` without a chassis. */
  systems: string
  modules: string
  /** Chassis and loadout, in Scrap. */
  scrap: number
}

const NONE: MechBuildFigures = { techLevel: undefined, systems: '', modules: '', scrap: 0 }

export function mechBuildFigures(
  mech: Pick<Mech, 'chassisRef' | 'systems' | 'modules'>
): MechBuildFigures {
  return readReference(
    'mechShelf.figures',
    () => {
      const chassis = mech.chassisRef ? resolveChassisRef(mech.chassisRef) : undefined
      if (!chassis) return { ...NONE, scrap: mechScrap(mech).total }
      const capacity = computeMechCapacity({
        chassisRef: mech.chassisRef,
        systems: mech.systems.map((ref) => ({ ref })),
        modules: mech.modules.map((ref) => ({ ref })),
      })
      return {
        techLevel: chassis.techLevel,
        systems: `${capacity.systemSlotsUsed}/${capacity.systemSlotsMax}`,
        modules: `${capacity.moduleSlotsUsed}/${capacity.moduleSlotsMax}`,
        scrap: mechScrap(mech).total,
      }
    },
    NONE
  )
}

/** A figure's leading number (`12/15` is 12); text sorts as text. */
const sortValue = (cell: unknown): number | string => {
  const text = typeof cell === 'string' || typeof cell === 'number' ? String(cell) : ''
  const lead = /^\d+/.exec(text)
  return lead ? Number(lead[0]) : text.toLowerCase()
}

/**
 * Rows in the pressed column's order: numbers by size, words by the alphabet,
 * the name breaking a tie. `keys` reads a row's value for a column's key.
 */
export function sortShelfRows<T extends { name: string }>(
  rows: readonly T[],
  sort: LedgerSort | undefined,
  keys: (row: T, key: string) => unknown
): T[] {
  if (!sort) return [...rows]
  const flip = sort.descending ? -1 : 1
  return [...rows].sort((a, b) => {
    const x = sortValue(sort.key === 'name' ? a.name : keys(a, sort.key))
    const y = sortValue(sort.key === 'name' ? b.name : keys(b, sort.key))
    const order =
      typeof x === 'number' && typeof y === 'number'
        ? x - y
        : String(x).localeCompare(String(y), undefined, { numeric: true })
    return order !== 0 ? order * flip : a.name.localeCompare(b.name)
  })
}

/** A press on a column: that column ascending, or flipped where it already sorts. */
export const nextSort = (now: LedgerSort | undefined, key: string): LedgerSort => ({
  key,
  descending: now?.key === key ? !now.descending : false,
})
