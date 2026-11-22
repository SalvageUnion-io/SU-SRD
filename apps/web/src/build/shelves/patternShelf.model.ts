/** What the Patterns shelf reads off a pattern: its line's values (r4 E13). */
import type { MechPattern } from 'game-domain/schemas/pattern'
import { formatDate } from '../../lib/formatDate'
import type { PatternSharing, ShelfGame } from '../../lib/shelves/shelfItems'
import { chassisFact, patternChips } from '../../lib/shelves/shelfItems'
import { buildShelvesCopy } from '../../messages/build-shelves'
import { mechBuildFigures } from './mechShelf.model'

/** A pattern's line, a value a column of `PATTERN_COLUMNS` by its key: what it shows and sorts by. */
export function patternLine(
  pattern: MechPattern,
  sharing: readonly PatternSharing[] | undefined,
  games: readonly ShelfGame[] | undefined
): { values: Record<string, string | number>; saved: string; over: string | undefined } {
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
      // Sorted by the moment, read as the day.
      saved: Number.isNaN(at) ? '' : at,
    },
    saved: Number.isNaN(at) ? '' : formatDate(at),
    over: figures.over ? (figures.overWhat ?? '') : undefined,
  }
}
