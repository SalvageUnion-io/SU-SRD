/**
 * The Homebrew library (ADR-056), as the client reads it: what a listing is
 * once its body is parsed, where it opens, what the gallery's search matches,
 * and what "Make a copy" writes to your own Training Bay.
 *
 * Pure. The gallery (`build/library/HomebrewLibrary.tsx`) draws these and the
 * server (`convex/library.ts`) decides what is listed.
 */

import { publicPath } from 'game-domain/entityKinds'
import type { Npc } from 'game-domain/schemas/npc'
import { NpcSchema } from 'game-domain/schemas/npc'
import type { MechPattern } from 'game-domain/schemas/pattern'
import { MechPatternSchema } from 'game-domain/schemas/pattern'
import type { RefChassis } from 'salvageunion-reference'
import type { CopyableBody } from '../copyEntity'
import { copyForShelf } from '../copyEntity'
import { patternChassis } from '../patterns/patterns'

/** What the library lists. */
export type LibraryKind = 'pattern' | 'npc'

/** One listing as `library.list` serves it. */
export type LibraryRow = {
  kind: LibraryKind
  appId: string
  body: unknown
  madeBy: string
  listedAt: number
  mine: boolean
}

/** A listing whose body parsed: a pattern with its chassis, or a built NPC. */
export type LibraryItem =
  | (Omit<LibraryRow, 'kind' | 'body'> & {
      kind: 'pattern'
      pattern: MechPattern
      chassis: RefChassis
    })
  | (Omit<LibraryRow, 'kind' | 'body'> & { kind: 'npc'; npc: Npc })

/** The gallery's Kind filter: both, or one. */
export type LibraryFilter = 'all' | LibraryKind

/** What each kind is called, one and many. */
export const LIBRARY_NOUN: Record<LibraryKind, { one: string; many: string }> = {
  pattern: { one: 'Pattern', many: 'Patterns' },
  npc: { one: 'NPC', many: 'NPCs' },
}

/**
 * A listing as the gallery draws it, or null when its body does not parse
 * here (a schema newer than this build) or a pattern's chassis is not in the
 * reference: such a listing is left out rather than drawn broken.
 */
export function libraryItem(row: LibraryRow): LibraryItem | null {
  const { body, ...rest } = row
  if (row.kind === 'pattern') {
    const parsed = MechPatternSchema.safeParse(body)
    if (!parsed.success) return null
    const chassis = patternChassis(parsed.data)
    return chassis ? { ...rest, kind: 'pattern', pattern: parsed.data, chassis } : null
  }
  const parsed = NpcSchema.safeParse(body)
  return parsed.success ? { ...rest, kind: 'npc', npc: { ...parsed.data, id: row.appId } } : null
}

/** Its name. */
export function itemName(item: LibraryItem): string {
  return item.kind === 'pattern' ? item.pattern.name : item.npc.name
}

/** Where a listing opens: its public page (ADR-032), the same one its share link names. */
export function itemHref(item: LibraryItem): string {
  return publicPath(item.kind, item.appId, itemName(item))
}

/**
 * Whether a listing matches the gallery's search: its name, its maker, and
 * what it is built on (a pattern's chassis, an NPC's position), ignoring case.
 */
function matchesSearch(item: LibraryItem, search: string): boolean {
  const needle = search.trim().toLowerCase()
  if (needle === '') return true
  const built = item.kind === 'pattern' ? item.chassis.name : (item.npc.position ?? '')
  return [itemName(item), item.madeBy, built].some((field) => field.toLowerCase().includes(needle))
}

/** The listings a filter and a search leave, in the order served (newest first). */
export function shownItems(
  items: readonly LibraryItem[],
  filter: LibraryFilter,
  search: string
): LibraryItem[] {
  return items.filter(
    (item) => (filter === 'all' || item.kind === filter) && matchesSearch(item, search)
  )
}

/**
 * A listed NPC as a new NPC of your own, on your shelf: a fresh id, full HP,
 * its maker's name kept (it is a copy of their design, not of yours, so it
 * reads as theirs until you rename it), and no Game.
 */
export function npcLibraryCopy(npc: Npc): CopyableBody {
  const copy = copyForShelf(npc as unknown as CopyableBody, npc.name)
  copy.name = npc.name
  copy.currentHP = npc.hitPoints
  return copy
}
