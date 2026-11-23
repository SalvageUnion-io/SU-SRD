import { Fragment } from 'react'
import type { LedgerColumn, LedgerRow } from './Ledger'
import { cellBody, isEmpty } from './ledgerCell'

/**
 * The rows a filter hides from a Ledger (its `sizer`, chrome K17): stacked in
 * one line of no height (`ledger.css`), each cell as wide as its column's
 * widest hidden value, in the cells' own type, so the columns stand where the
 * whole list sets them while only the rows that match are drawn. Unread
 * (`aria-hidden`) and out of reach (`inert`).
 */
export function LedgerSizer({
  rows,
  columns,
  nameClass,
  phoneLine,
  hasTrailing,
  hasFill,
}: {
  rows: readonly LedgerRow[]
  columns: readonly LedgerColumn[]
  /** The name's caps, as a drawn row's name wears them. */
  nameClass: string
  /** The column a phone drops under the name, as the drawn rows mark it. */
  phoneLine: string | undefined
  hasTrailing: boolean
  hasFill: boolean
}) {
  return (
    <tbody className="su-ledger__sizer" aria-hidden="true" inert>
      <tr>
        <th>
          {rows.map((row) => (
            <Fragment key={row.id}>
              <span className="su-ledger__name-line">
                <span className={nameClass}>{row.name}</span>
                {row.stamp}
              </span>
              {row.under && <span className="su-ledger__under">{row.under}</span>}
            </Fragment>
          ))}
        </th>
        {columns.map((column, cell) => (
          <td
            key={column.key}
            data-kind={column.kind ?? 'figure'}
            data-phone={column.phone || undefined}
            data-spare={column.spare || undefined}
            data-line={column.key === phoneLine || undefined}
          >
            {rows.map((row) => (
              <div key={row.id} data-empty={isEmpty(row.cells[cell]) || undefined}>
                {isEmpty(row.cells[cell]) ? '—' : cellBody(row.cells[cell])}
              </div>
            ))}
          </td>
        ))}
        {hasTrailing && (
          <td data-kind="trailing" data-phone="">
            {rows.map((row) => (
              <div key={row.id}>{row.trailing}</div>
            ))}
          </td>
        )}
        {hasFill && <td data-kind="fill" />}
      </tr>
    </tbody>
  )
}
