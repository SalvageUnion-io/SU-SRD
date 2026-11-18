// MOCK (Working Manual, wave 2): a Review step's list of what was picked, as
// the reading lane's Ledger (`components/entity/Ledger.tsx`) in the wizard's
// band paint: one line an entity (a copy count at its end), the same columns
// its picker showed, its made choices under its name (hard rule R60), and the
// sums on a last ink line. It replaces the wall of full cards a review drew.
import type { ReactNode } from 'react'
import type { ChoiceSelections, RefMetaEntity } from 'salvageunion-reference'
import { nameToSlug } from 'salvageunion-reference'
import { Ledger } from '../../components/entity/Ledger'
import type { Paint } from '../../components/entity/parts/paint'
import { CiteLine } from '../../components/index'
import type { PickColumn } from './PickList'
import { chosenChips, modelOf } from './pickColumns'

/** The wizard's band paint (`--tone`, the kind's colour), for a Ledger in it. */
export const WIZ_PAINT: Paint = {
  background: 'var(--tone-band, var(--tone))',
  color: 'var(--on-tone-band, var(--color-ink))',
  ink: false,
}

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
  const text = (value: ReactNode) => (value === null || value === undefined ? '' : value)
  return (
    <Ledger
      label={title}
      paint={WIZ_PAINT}
      nameLabel={title}
      count={entities.length}
      columns={columns.map((column) => ({
        key: column.key,
        label: column.label,
        ...(column.title ? { title: column.title } : {}),
        kind:
          column.kind === 'quiet' || column.kind === 'line' ? 'quiet' : (column.kind ?? 'figure'),
        ...(column.phone ? { phone: true } : {}),
      }))}
      rows={rows.map(({ entity, count }) => ({
        id: entity.id,
        name: entity.name,
        entityRef: modelOf(entity).ref,
        cells: columns.map((column) => text(column.value(entity))),
        trailing: count > 1 ? `×${count}` : '',
        under: chosenChips(entity, choices?.[nameToSlug(entity.name)]),
      }))}
      trailingLabel="Qty"
      empty={empty}
      {...(total ? { total: { label: 'Total', cells: total(rows) } } : {})}
      {...(cite ? { foot: <CiteLine text={cite} /> } : {})}
    />
  )
}
