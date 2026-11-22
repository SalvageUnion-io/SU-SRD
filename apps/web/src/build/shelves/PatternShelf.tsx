/**
 * The Patterns shelf: the Training Bay's panel, and the Patterns page whole.
 * Each line says what tells two patterns of one name apart (its chassis, who
 * sees it, Tech Level, slots filled, Scrap, when it was saved, its description's
 * first line), and any column
 * sorts it (r4 E13). A narrow panel spares all but its chassis and Systems.
 */
import type { MechPattern } from 'game-domain/schemas/pattern'
import type { ReactNode } from 'react'
import { useState } from 'react'
import type { HeaderMenuItem, LedgerSort } from '../../components/index'
import { savedPatternHref } from '../../lib/patterns/patterns'
import type { PatternSharing, ShelfGame } from '../../lib/shelves/shelfItems'
import { buildShelvesCopy } from '../../messages/build-shelves'
import { nextSort, sortShelfRows } from './mechShelf.model'
import { patternLine } from './patternShelf.model'
import { findMatches, useShelfFind } from './ShelfFind'
import { ShelfLedger } from './ShelfLedger'
import { PATTERN_COLUMNS, scrapCell } from './shelfColumns'

export function PatternShelf({
  patterns,
  sharing,
  games,
  action,
  line,
}: {
  patterns: readonly MechPattern[]
  /** Who can see each; undefined while it loads, or with no server to ask. */
  sharing: readonly PatternSharing[] | undefined
  games: readonly ShelfGame[] | undefined
  action?: ReactNode
  /** What the page hangs on a pattern's line: its mark, its one act, its menu. */
  line: (
    pattern: MechPattern,
    over: string | undefined
  ) => {
    under?: ReactNode
    act?: { label: string; onSelect: () => void } | undefined
    menu: HeaderMenuItem[][]
  }
}) {
  const [sort, setSort] = useState<LedgerSort | undefined>(undefined)
  const find = useShelfFind(buildShelvesCopy('findAPattern'), patterns.length)
  const rows = patterns
    .map((pattern) => ({ pattern, name: pattern.name, ...patternLine(pattern, sharing, games) }))
    // Its find box keeps the lines whose name, chassis or description match (r5 D4).
    .filter((row) => findMatches(find.query, [row.name, row.values.chassis, row.pattern.notes]))
  return (
    <ShelfLedger
      id="shelf-patterns"
      title={buildShelvesCopy('patterns')}
      tone="mech"
      homebrew
      columns={PATTERN_COLUMNS}
      action={action}
      empty={
        find.query.trim()
          ? buildShelvesCopy('noneFound', { query: find.query.trim() })
          : buildShelvesCopy('noPatternsYet')
      }
      find={find.field}
      sort={sort}
      onSort={(key) => setSort(nextSort(sort, key))}
      rows={sortShelfRows(rows, sort, (row, key) =>
        key === buildShelvesCopy('cost') ? row.values.scrapSort : row.values[key]
      ).map(({ pattern, values, saved, over, about }) => {
        const { under, ...rest } = line(pattern, over)
        return {
          id: pattern.id,
          name: pattern.name,
          href: savedPatternHref(pattern.id),
          cells: PATTERN_COLUMNS.map((column) =>
            column.key === 'saved'
              ? saved
              : column.key === buildShelvesCopy('cost')
                ? scrapCell(values[column.key])
                : (values[column.key] ?? '')
          ),
          // Its description's first line, then any mark (r5 D3).
          under:
            about === undefined ? (
              under
            ) : (
              <>
                <span>{about}</span>
                {under}
              </>
            ),
          ...rest,
        }
      })}
    />
  )
}
