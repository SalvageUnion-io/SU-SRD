/**
 * The Training Bay's Mechs shelf: every mech of yours (one a pilot flies is on
 * that pilot's row too, and names them under its name here, r4 E20), each
 * line saying what tells two builds on one chassis apart (Tech Level, slots filled, Scrap), and any column sorting it.
 * A build over its chassis's slots wears the rule-breaking mark under its name,
 * and the sort is remembered across a reload. Its Pattern column names what it
 * was built from, and its find box keeps the lines that match (r5 D4).
 */
import type { Mech } from 'game-domain/schemas/mech'
import type { ReactNode } from 'react'
import { useState } from 'react'
import { RuleBreakMark } from '../../components/app'
import type { HeaderMenuItem, LedgerSort } from '../../components/index'
import { chassisFact } from '../../lib/shelves/shelfItems'
import { VITAL } from '../../lib/units/readings'
import type { UnitReading } from '../../lib/units/unitModel'
import { buildShelvesCopy } from '../../messages/build-shelves'
import { usePatterns } from '../../replica/collections'
import { mechPatternStamp } from '../sheet/bandStamps.model'
import {
  mechBuildFigures,
  nextSort,
  rememberSort,
  sortShelfRows,
  storedSort,
} from './mechShelf.model'
import { findMatches, useShelfFind } from './ShelfFind'
import { ShelfLedger } from './ShelfLedger'
import { inGame, MECH_COLUMNS, read, scrapCell } from './shelfColumns'

type MechLine = {
  /** Its own labels (`Shared by link`), under its name. */
  under?: ReactNode
  /** The Game it is in. */
  game: readonly { value: string; href: string }[]
  menu: HeaderMenuItem[][]
}

export function MechShelf({
  mechs,
  readings,
  line,
  action,
  empty,
}: {
  mechs: readonly Mech[]
  readings: ReadonlyMap<string, readonly UnitReading[]>
  /** What the page knows of a mech: its labels, its Game, its menu. */
  line: (mech: Mech) => MechLine
  action?: ReactNode
  empty: string
}) {
  // The sort is kept for the next visit (this browser's storage, a convenience).
  const [sort, setSort] = useState<LedgerSort | undefined>(storedSort)
  const patterns = usePatterns((s) => s.mechPatterns)
  const find = useShelfFind(buildShelvesCopy('findAMech'), mechs.length)
  const rows = mechs.map((mech) => {
    const r = readings.get(mech.id)
    const figures = mechBuildFigures(mech)
    const own = line(mech)
    // One a column of `MECH_COLUMNS`, by its key.
    const values: Record<string, string | number> = {
      chassis: chassisFact(mech.chassisRef) ?? '',
      pattern: mechPatternStamp(mech, (id) => patterns.find((p) => p.id === id)?.name)?.name ?? '',
      game: own.game[0]?.value ?? '',
      [buildShelvesCopy('tl')]: figures.techLevel ?? '',
      [buildShelvesCopy('sys')]: figures.systems,
      [buildShelvesCopy('mod')]: figures.modules,
      [buildShelvesCopy('cost')]: figures.scrap,
      [VITAL.sp]: read(r, VITAL.sp),
      [VITAL.ep]: read(r, VITAL.ep),
      [VITAL.heat]: read(r, VITAL.heat),
    }
    return {
      mech,
      name: mech.name,
      own,
      values,
      scrapSort: figures.scrapSort,
      over: figures.over,
      what: figures.overWhat,
    }
  })
  const found = rows.filter((row) =>
    findMatches(find.query, [row.name, row.values.chassis, row.values.pattern])
  )
  return (
    <ShelfLedger
      id="shelf-mechs"
      title={buildShelvesCopy('mechs')}
      tone="mech"
      columns={MECH_COLUMNS}
      action={action}
      empty={
        find.query.trim() ? buildShelvesCopy('noneFound', { query: find.query.trim() }) : empty
      }
      find={find.field}
      sort={sort}
      onSort={(key) => {
        const next = nextSort(sort, key)
        rememberSort(next)
        setSort(next)
      }}
      // Scrap sorts by its highest Tech Level, then its amount (r6 E4).
      rows={sortShelfRows(found, sort, (row, key) =>
        key === buildShelvesCopy('cost') ? row.scrapSort : row.values[key]
      ).map(({ mech, own, values, over, what }) => ({
        id: mech.id,
        name: mech.name,
        href: `/mechs/${mech.id}`,
        // A build over its chassis's slots says so in words, and which limit
        // it is over, under its name (R71, r3 L5).
        under: over ? (
          <>
            {own.under}
            <RuleBreakMark what={what} />
          </>
        ) : (
          own.under
        ),
        cells: MECH_COLUMNS.map((column) =>
          column.key === 'game'
            ? inGame(own.game)
            : column.key === buildShelvesCopy('cost')
              ? scrapCell(values[column.key])
              : (values[column.key] ?? '')
        ),
        menu: own.menu,
      }))}
    />
  )
}
