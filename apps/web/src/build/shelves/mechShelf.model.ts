/**
 * The Mechs shelf's build figures and its sort: what tells two builds on one
 * chassis apart (Tech Level, slots filled, Scrap), read off the mech, and the
 * order a pressed column puts the rows in.
 */
import type { Mech } from 'game-domain/schemas/mech'
import { computeMechCapacity, resolveChassisRef } from 'salvageunion-reference/rules'
import type { LedgerSort } from '../../components/index'
import { readReference } from '../../lib/readReference'
import { mechScrap, scrapSortKey, scrapSplit } from '../../lib/rules/mechScrap'
import { localStore } from '../../lib/safeLocalStorage'
import { buildShelvesCopy } from '../../messages/build-shelves'

export type MechBuildFigures = {
  /** The chassis's Tech Level; none without a chassis. */
  techLevel: number | string | undefined
  /** Slots filled of the chassis's (`12/12`); `''` without a chassis. */
  systems: string
  modules: string
  /** Chassis and loadout, in Scrap by Tech Level (`TL1 18 · TL2 5`, r6 E4); `''` for none. */
  scrap: string
  /** What the Scrap column sorts by: the highest Tech Level, then its amount (`scrapSortKey`). */
  scrapSort: number
  /** A slot count is over its chassis's (the book's own printed loadout never is). */
  over: boolean
  /** Which counts are over, in words: "System Slots 13/12" (r3 L5). */
  overWhat?: string | undefined
}

const NONE: MechBuildFigures = {
  techLevel: undefined,
  systems: '',
  modules: '',
  scrap: '',
  scrapSort: 0,
  over: false,
}

/** The Scrap figures of a build: its words and its sort. */
const scrapOf = (mech: Pick<Mech, 'chassisRef' | 'systems' | 'modules'>) => {
  const scrap = mechScrap(mech)
  return { scrap: scrapSplit(scrap), scrapSort: scrapSortKey(scrap) }
}

export function mechBuildFigures(
  mech: Pick<Mech, 'chassisRef' | 'systems' | 'modules'>
): MechBuildFigures {
  return readReference(
    'mechShelf.figures',
    () => {
      const chassis = mech.chassisRef ? resolveChassisRef(mech.chassisRef) : undefined
      if (!chassis) return { ...NONE, ...scrapOf(mech) }
      const capacity = computeMechCapacity({
        chassisRef: mech.chassisRef,
        systems: mech.systems.map((ref) => ({ ref })),
        modules: mech.modules.map((ref) => ({ ref })),
      })
      const systems = `${capacity.systemSlotsUsed}/${capacity.systemSlotsMax}`
      const modules = `${capacity.moduleSlotsUsed}/${capacity.moduleSlotsMax}`
      // A line the book prints over its slots is the book's, each line on its own (r4 E16).
      const broken = [
        ...(capacity.systemSlotsUsed > capacity.systemSlotsMax && !capacity.asPrinted?.systems
          ? [buildShelvesCopy('systemSlotsOver', { count: systems })]
          : []),
        ...(capacity.moduleSlotsUsed > capacity.moduleSlotsMax && !capacity.asPrinted?.modules
          ? [buildShelvesCopy('moduleSlotsOver', { count: modules })]
          : []),
      ]
      return {
        techLevel: chassis.techLevel,
        systems,
        modules,
        ...scrapOf(mech),
        over: broken.length > 0,
        ...(broken.length > 0 ? { overWhat: broken.join(' · ') } : {}),
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

/** Where this browser keeps the Mechs shelf's sort. */
export const MECH_SORT_KEY = 'su:shelf-mechs:sort'

/** The remembered sort; none where storage is missing, blocked, empty or not a sort. */
export function storedSort(): LedgerSort | undefined {
  try {
    const kept: unknown = JSON.parse(localStore()?.getItem(MECH_SORT_KEY) ?? 'null')
    if (kept === null || typeof kept !== 'object') return undefined
    const { key, descending } = kept as Record<string, unknown>
    return typeof key === 'string' ? { key, descending: descending === true } : undefined
  } catch {
    return undefined
  }
}

/** Keep the sort for the next visit: a convenience that may quietly fail. */
export function rememberSort(sort: LedgerSort): void {
  try {
    localStore()?.setItem(MECH_SORT_KEY, JSON.stringify(sort))
  } catch {
    // Storage refused (private mode, quota): the sort holds for this visit only.
  }
}

/** A press on a column: that column ascending, or flipped where it already sorts. */
export const nextSort = (now: LedgerSort | undefined, key: string): LedgerSort => ({
  key,
  descending: now?.key === key ? !now.descending : false,
})
