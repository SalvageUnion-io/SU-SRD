// MOCK (Working Manual, the blend of the book's table and the pick Compacts):
// the wizard's picker as ONE frame in the kind's band paint. Its head is one
// strip in the band colour, the column labels on it as the site's ink stamps;
// each option is a Mini-height select row, its name in the caps face, its
// values plain condensed tabular numerals in fixed columns (ruleset §2.6), the
// rows banded paper and page ground. The picked row is set in ink (as a rolled
// row is), never a left rail (§3.10). Each row is a native radio, so the group
// keeps its arrow keys. Its look is `.su-wiz-pick*` in `styles/build/wizard.css`.
import type { ReactNode } from 'react'
import { useId } from 'react'
import { Badge } from '../../components/index'
import { cn } from '../../lib/cn'

export type PickColumn<T> = {
  key: string
  /** The column's stamp (`SP`, `SYS`). */
  label: string
  /** The stamp's long name, for a pointer (`System slots`). */
  title?: string
  value: (row: T) => ReactNode
  /** Text, not a figure: left-aligned body copy that takes the room left. */
  text?: boolean
  /** Set apart from the columns before it (the cost after the stats). */
  apart?: boolean
}

type PickListProps<T> = {
  /** The radio group's name for a screen reader. */
  ariaLabel: string
  /** The name column's stamp (`Chassis`, `Class`). */
  nameLabel: string
  rows: readonly T[]
  rowKey: (row: T) => string
  rowName: (row: T) => string
  columns: readonly PickColumn<T>[]
  /** The picked row's key. */
  selected: string | undefined
  onSelect: (key: string) => void
}

export function PickList<T>({
  ariaLabel,
  nameLabel,
  rows,
  rowKey,
  rowName,
  columns,
  selected,
  onSelect,
}: PickListProps<T>) {
  const group = useId()
  const hasText = columns.some((column) => column.text)
  const cellClass = (column: PickColumn<T>) =>
    cn(
      'su-wiz-pick__cell',
      column.text && 'su-wiz-pick__cell--text',
      column.apart && 'su-wiz-pick__cell--apart'
    )
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className={cn('su-wiz-pick', hasText && 'su-wiz-pick--text')}
      // The one track list every line shares (the rows are subgrids): the name,
      // then a track a column, a text column taking the room left.
      style={{
        gridTemplateColumns: [
          hasText ? 'max-content' : 'minmax(0, 1fr)',
          ...columns.map((column) => (column.text ? 'minmax(0, 1fr)' : 'max-content')),
        ].join(' '),
      }}
    >
      <div aria-hidden="true" className="su-wiz-pick__head">
        <span className="su-wiz-pick__cell su-wiz-pick__cell--name">
          <Badge shape="stamp" size="mini">
            {nameLabel}
          </Badge>
        </span>
        {columns.map((column) => (
          <span key={column.key} title={column.title} className={cellClass(column)}>
            <Badge shape="stamp" size="mini">
              {column.label}
            </Badge>
          </span>
        ))}
      </div>
      {rows.map((row) => {
        const key = rowKey(row)
        const isSelected = key === selected
        return (
          <label
            key={key}
            className={cn('su-wiz-pick__row', isSelected && 'su-wiz-pick__row--selected')}
          >
            <span className="su-wiz-pick__cell su-wiz-pick__cell--name">
              <input
                type="radio"
                name={group}
                className="su-sr-only"
                checked={isSelected}
                onChange={() => onSelect(key)}
              />
              {rowName(row)}
            </span>
            {columns.map((column) => (
              <span key={column.key} className={cellClass(column)}>
                {column.title && <span className="su-sr-only">{column.title} </span>}
                {column.value(row)}
              </span>
            ))}
          </label>
        )
      })}
    </div>
  )
}
