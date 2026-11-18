// The wizard's picker: the Ledger in select (ledger.md L7), in the wizard's
// band paint, its rows read off the step's own records.
//
// Two picks:
//  - one of the rows (the default): each row is a radio, the picked row inked.
//  - `count`: any number of copies of any rows. The row's radio is then what
//    the detail beside the list shows, and its last cell is the count's own
//    stepper (ruleset §6.2). A row with a copy is inked.
import type { ReactNode } from 'react'
import { CiteLine, Ledger } from '../../components/index'
import type { PickColumn } from './pickLedger.model'
import { ledgerColumns, WIZ_PAINT } from './pickLedger.model'

type PickCount<T> = {
  /** The trailing column's stamp (`Qty`). */
  label: string
  value: (row: T) => number
  /** The most copies the row may hold now (its count plus what still fits). */
  max: (row: T) => number
  onChange: (row: T, next: number) => void
}

type PickListProps<T> = {
  /** The picker's title, on the head's cut-out; it names the list too. */
  title: string
  /** The head strip's last mark: what the pick asks (`Choose 1`) or its budget. */
  note?: ReactNode
  rows: readonly T[]
  rowKey: (row: T) => string
  rowName: (row: T) => string
  columns: readonly PickColumn<T>[]
  /** The picked row's key; with `count`, the row the detail shows. */
  selected: string | undefined
  onSelect: (key: string) => void
  /** With it the pick is a count a row. */
  count?: PickCount<T>
  /** One stamp at the name's end (`Suggested`). */
  stamp?: (row: T) => ReactNode
  /** Under a picked row's name: its made choices (`CHOSEN | Energy`, R60). */
  under?: (row: T) => ReactNode
  /** Why a row cannot be picked now; it dims, and says why on a pointer. */
  disabled?: (row: T) => string | undefined
  /** The selected row's card, opened under its line where no column stands beside the list. */
  detail?: (row: T) => ReactNode
  /** `always`: the detail opens under its line at every width (a row's own fields). */
  detailAt?: 'narrow' | 'always'
  /** The foot: the source on its cut-out, a plain fact left of it (`COSTS | …`). */
  foot?: { cite: string; meta?: { label: string; value: string } }
}

export function PickList<T>({
  title,
  note,
  rows,
  rowKey,
  rowName,
  columns,
  selected,
  onSelect,
  count,
  stamp,
  under,
  disabled,
  detail,
  detailAt,
  foot,
}: PickListProps<T>) {
  return (
    <Ledger
      label={title}
      nameLabel={title}
      paint={WIZ_PAINT}
      note={note}
      columns={ledgerColumns(columns)}
      select={{ selected, onSelect, ...(detailAt ? { detailAt } : {}) }}
      {...(count ? { trailingLabel: count.label } : {})}
      rows={rows.map((row) => {
        const key = rowKey(row)
        const name = rowName(row)
        const copies = count?.value(row) ?? 0
        const picked = count ? copies > 0 : key === selected
        const blocked = disabled?.(row)
        return {
          id: key,
          name,
          entityRef: undefined,
          stamp: stamp?.(row),
          cells: columns.map((column) => column.value(row)),
          under: picked ? under?.(row) : undefined,
          ...(count ? { picked } : {}),
          ...(blocked !== undefined ? { blocked } : {}),
          ...(detail && key === selected ? { detail: detail(row) } : {}),
          ...(count
            ? {
                trailing: (
                  <PickStepper
                    name={name}
                    label={count.label}
                    copies={copies}
                    most={count.max(row)}
                    blocked={blocked}
                    onChange={(next) => count.onChange(row, next)}
                  />
                ),
              }
            : {}),
        }
      })}
      {...(foot ? { foot: <CiteLine text={foot.cite} /> } : {})}
      {...(foot?.meta ? { footMeta: [foot.meta] } : {})}
    />
  )
}

/** A row's count, a − and + about its figure (ruleset §6.2). */
function PickStepper({
  name,
  label,
  copies,
  most,
  blocked,
  onChange,
}: {
  name: string
  label: string
  copies: number
  most: number
  blocked: string | undefined
  onChange: (next: number) => void
}) {
  return (
    <span className="su-ledger__stepper">
      <button
        type="button"
        className="su-ledger__step"
        aria-label={`Remove ${name}`}
        disabled={copies === 0}
        onClick={() => onChange(copies - 1)}
      >
        −
      </button>
      <span className="su-ledger__copies" data-empty={copies === 0 || undefined}>
        <span className="su-sr-only">{label} </span>
        {copies}
      </span>
      <button
        type="button"
        className="su-ledger__step"
        aria-label={`Add ${name}`}
        title={copies >= most ? blocked : undefined}
        disabled={copies >= most}
        onClick={() => onChange(copies + 1)}
      >
        +
      </button>
    </span>
  )
}
