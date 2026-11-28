/** What the Patterns shelf reads off a pattern: its line's values (r4 E13). */
import type { MechPattern } from 'game-domain/schemas/pattern'
import { formatDateTime } from '../../lib/formatDate'
import type { PatternSharing, ShelfGame } from '../../lib/shelves/shelfItems'
import { chassisFact, patternChips } from '../../lib/shelves/shelfItems'
import { buildShelvesCopy } from '../../messages/build-shelves'
import { mechBuildFigures } from './mechShelf.model'

/** A pattern's line, a value a column of `PATTERN_COLUMNS` by its key: what it shows and sorts by. */
export function patternLine(
  pattern: MechPattern,
  sharing: readonly PatternSharing[] | undefined,
  games: readonly ShelfGame[] | undefined,
  /** The account's Mechs: those built from it are its Used by (r7 G2). */
  mechs: readonly { sourcePattern?: string | undefined }[] = []
): {
  values: Record<string, string | number>
  saved: string
  over: string | undefined
  /** The first line of its description, under its name (r5 D3). */
  about: string | undefined
} {
  const figures = mechBuildFigures(pattern)
  const at = Date.parse(pattern.createdAt)
  return {
    values: {
      chassis: chassisFact(pattern.chassisRef) ?? '',
      who: patternChips(
        sharing?.find((s) => s.appId === pattern.id),
        games
      )
        .map((chip) => chip.label)
        .join(', '),
      [buildShelvesCopy('tl')]: figures.techLevel ?? '',
      [buildShelvesCopy('sys')]: figures.systems,
      [buildShelvesCopy('mod')]: figures.modules,
      [buildShelvesCopy('cost')]: figures.scrap,
      [buildShelvesCopy('usedBy')]: mechs.filter((mech) => mech.sourcePattern === pattern.id)
        .length,
      // What the Scrap column sorts by, never shown (r6 E4).
      scrapSort: figures.scrapSort,
      // Sorted by the moment, read as the day.
      saved: Number.isNaN(at) ? '' : at,
    },
    // The time too: two saved the same day differ by it (r5 D3).
    saved: Number.isNaN(at) ? '' : formatDateTime(at),
    over: figures.over ? (figures.overWhat ?? '') : undefined,
    about: pattern.notes?.trim().split('\n')[0]?.trim() || undefined,
  }
}
