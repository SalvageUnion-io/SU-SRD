/**
 * The Training Bay's Mechs shelf: the mechs no pilot of yours flies (a piloted
 * mech is on its pilot's row), each line saying what tells two builds on one
 * chassis apart (Tech Level, slots filled, Scrap), and any column sorting it.
 * A build over its chassis's slots wears the rule-breaking mark under its name,
 * and the sort is remembered across a reload.
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
import {
  mechBuildFigures,
  nextSort,
  rememberSort,
  sortShelfRows,
  storedSort,
} from './mechShelf.model'
import { ShelfLedger } from './ShelfLedger'
import { inGame, MECH_COLUMNS, read } from './shelfColumns'

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
  const rows = mechs.map((mech) => {
    const r = readings.get(mech.id)
    const figures = mechBuildFigures(mech)
    const own = line(mech)
    // One a column of `MECH_COLUMNS`, by its key.
    const values: Record<string, string | number> = {
      chassis: chassisFact(mech.chassisRef) ?? '',
      game: own.game[0]?.value ?? '',
      [buildShelvesCopy('tl')]: figures.techLevel ?? '',
      [buildShelvesCopy('sys')]: figures.systems,
      [buildShelvesCopy('mod')]: figures.modules,
      [buildShelvesCopy('cost')]: figures.scrap > 0 ? figures.scrap : '',
      [VITAL.sp]: read(r, VITAL.sp),
      [VITAL.ep]: read(r, VITAL.ep),
      [VITAL.heat]: read(r, VITAL.heat),
    }
    return { mech, name: mech.name, own, values, over: figures.over }
  })
  return (
    <ShelfLedger
      id="shelf-mechs"
      title={buildShelvesCopy('mechs')}
      tone="mech"
      columns={MECH_COLUMNS}
      action={action}
      empty={empty}
      sort={sort}
      onSort={(key) => {
        const next = nextSort(sort, key)
        rememberSort(next)
        setSort(next)
      }}
      rows={sortShelfRows(rows, sort, (row, key) => row.values[key]).map(
        ({ mech, own, values, over }) => ({
          id: mech.id,
          name: mech.name,
          href: `/mechs/${mech.id}`,
          // A build over its chassis's slots says so in words, under its name (R71).
          under: over ? (
            <>
              {own.under}
              <RuleBreakMark />
            </>
          ) : (
            own.under
          ),
          cells: MECH_COLUMNS.map((column) =>
            column.key === 'game' ? inGame(own.game) : (values[column.key] ?? '')
          ),
          menu: own.menu,
        })
      )}
    />
  )
}
