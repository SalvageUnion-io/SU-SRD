// A Review step's list of what was picked, as a Ledger in the wizard's band
// paint: one line an entity (a copy count at its end), the same columns its
// picker showed, its made choices under its name (hard rule R60), and the sums
// on a last ink line.
import type { ReactNode } from 'react'
import type { ChoiceSelections, RefMetaEntity } from 'salvageunion-reference'
import { nameToSlug } from 'salvageunion-reference'
import { CiteLine, Ledger } from '../../components/index'
import { buildWizardCopy } from '../../messages/build-wizard'
import { chosenChips, modelOf } from './pickColumns'
import type { PickColumn } from './pickLedger.model'
import { ledgerColumns, WIZ_PAINT } from './pickLedger.model'

type ReviewLedgerProps<T extends RefMetaEntity> = {
  title: string
  /** The picks, one entry a copy. */
  entities: readonly T[]
  columns: readonly PickColumn<T>[]
  /** Each pick's chosen options, by slug. */
  choices?: Record<string, ChoiceSelections>
  /** Said when nothing was picked (`None installed`). */
  empty: string
  /** The sums line, a cell a column (`''` leaves one bare). */
  total?: (rows: readonly { entity: T; count: number }[]) => readonly ReactNode[]
  cite?: string
}

export function ReviewLedger<T extends RefMetaEntity>({
  title,
  entities,
  columns,
  choices,
  empty,
  total,
  cite,
}: ReviewLedgerProps<T>) {
  const rows: { entity: T; count: number }[] = []
  for (const entity of entities) {
    const known = rows.find((row) => row.entity === entity)
    if (known) known.count += 1
    else rows.push({ entity, count: 1 })
  }
  return (
    <Ledger
      label={title}
      paint={WIZ_PAINT}
      nameLabel={title}
      count={entities.length}
      columns={ledgerColumns(columns)}
      rows={rows.map(({ entity, count }) => ({
        id: entity.id,
        name: entity.name,
        entityRef: modelOf(entity).ref,
        cells: columns.map((column) => column.value(entity)),
        trailing: count > 1 ? `×${count}` : '',
        under: chosenChips(entity, choices?.[nameToSlug(entity.name)]),
      }))}
      trailingLabel={buildWizardCopy('qty')}
      empty={empty}
      {...(total ? { total: { label: 'Total', cells: total(rows) } } : {})}
      {...(cite ? { foot: <CiteLine text={cite} /> } : {})}
    />
  )
}
