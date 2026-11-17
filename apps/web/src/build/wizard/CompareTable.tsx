// MOCK (Working Manual, "Compare in columns"): the wizard's compare-table
// picker. One row an option, one column a stat in the book's order (§2.6),
// tabular figures; the row is a native radio, so the group keeps arrow keys.
// Its look is `.su-wiz-compare*` in `styles/build/wizard.css`.
import type { ReactNode } from 'react'
import { useId } from 'react'
import { cn } from '../../lib/cn'

export type CompareColumn<T> = {
  key: string
  /** The column head: a stat's short name (`SP`, `Sys`). */
  label: string
  /** The head's long name, for a pointer and a screen reader (`System slots`). */
  title?: string
  value: (row: T) => ReactNode
  /** Text, not a figure: left-aligned, wraps. */
  text?: boolean
  /** Dropped on a phone, where only the figures that decide stay. */
  wideOnly?: boolean
}

type CompareTableProps<T> = {
  /** The radio group's name for a screen reader. */
  ariaLabel: string
  /** The first column's head (`Chassis`, `Class`). */
  nameLabel: string
  rows: readonly T[]
  rowKey: (row: T) => string
  rowName: (row: T) => string
  columns: readonly CompareColumn<T>[]
  /** The picked row's key. */
  selected: string | undefined
  onSelect: (key: string) => void
  /** Why a row cannot be picked; it stays visible, dimmed. */
  disabledReason?: (row: T) => string | undefined
}

export function CompareTable<T>({
  ariaLabel,
  nameLabel,
  rows,
  rowKey,
  rowName,
  columns,
  selected,
  onSelect,
  disabledReason,
}: CompareTableProps<T>) {
  const group = useId()
  return (
    <div className="su-wiz-compare__scroll">
      <table className="su-wiz-compare" aria-label={ariaLabel}>
        <thead>
          <tr>
            <th scope="col" className="su-wiz-compare__name">
              {nameLabel}
            </th>
            {columns.map((column) => (
              <th
                key={column.key}
                scope="col"
                title={column.title}
                className={cn(
                  column.text && 'su-wiz-compare__text',
                  column.wideOnly && 'su-wiz-compare__wide'
                )}
              >
                {column.title ? <abbr title={column.title}>{column.label}</abbr> : column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const key = rowKey(row)
            const reason = disabledReason?.(row)
            const isSelected = key === selected
            return (
              // biome-ignore lint/a11y/useKeyWithClickEvents: MOCK: the row's radio carries the keys; the click widens its target to the row
              <tr
                key={key}
                className={cn(
                  'su-wiz-compare__row',
                  isSelected && 'su-wiz-compare__row--selected',
                  reason && 'su-wiz-compare__row--disabled'
                )}
                onClick={reason ? undefined : () => onSelect(key)}
              >
                <th scope="row" className="su-wiz-compare__name">
                  <label className="su-wiz-compare__pick">
                    <input
                      type="radio"
                      name={group}
                      checked={isSelected}
                      disabled={reason !== undefined}
                      onChange={() => onSelect(key)}
                    />
                    <span>{rowName(row)}</span>
                  </label>
                  {reason && <span className="su-wiz-compare__reason">{reason}</span>}
                </th>
                {columns.map((column) => (
                  <td
                    key={column.key}
                    className={cn(
                      column.text && 'su-wiz-compare__text',
                      column.wideOnly && 'su-wiz-compare__wide'
                    )}
                  >
                    {column.value(row)}
                  </td>
                ))}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
