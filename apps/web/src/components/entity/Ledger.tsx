// MOCK (Working Manual): the LEDGER, a list of entities to compare as ONE
// framed block: the Compact's frame in the list's band colour, one column-head
// strip on the band carrying the column labels as stamps, then a Mini-height
// line per entity: its name (the link and Peek, a `Mention`), an optional stamp
// (TL, Starting), and its values in fixed columns as plain tabular numerals.
// Rows band paper and cream as the roll table's do. Its two cut-outs are the
// app's own: the list's title on the Compact head's paper tab
// (`.su-entity-compact__notch` + `__title`), notched into the head strip's
// foot, and its sources on the card foot's cut-out (`EntityCardIdentityFooter`
// on the band, `--su-foot-ground`). Not shipped code.
import type { ReactNode } from 'react'
import type { EntityRef } from 'salvageunion-reference'
import { cn } from '../../lib/cn'
import { Badge } from '../atoms/Badge'
import { Box } from '../containers/Box'
import { grainClass } from '../referenceEntity/card/cardGrain'
import { EntityCardIdentityFooter } from '../referenceEntity/card/EntityCardIdentityFooter'
import { Mention } from './forms/Mention'
import type { Paint } from './parts/paint'

export type LedgerColumn = {
  key: string
  label: string
  /** The label spelled out, on hover and for a screen reader. */
  title?: string
  /** `figure`: a numeral, centred in its column; `text`: a word; `quiet`: a line of words, muted, taking the room left. */
  kind: 'figure' | 'text' | 'quiet'
  /** Kept on a phone. */
  phone?: boolean
}

export type LedgerRow = {
  id: string
  name: string
  /** The entity the name links to and Peeks. */
  entityRef: EntityRef | undefined
  /** The row's one stamp, at the name cell's end (`TL | 1`, Starting). */
  stamp?: ReactNode
  /** One per column, in order; an empty string draws `—`. */
  cells: readonly string[]
}

export type LedgerSort = { key: string; descending: boolean }

export function Ledger({
  paint,
  nameLabel,
  count,
  columns,
  rows,
  foot,
  sort,
  onSort,
  label,
}: {
  /** The band's paint (`paintFor`): the frame's colour and the head strip's. */
  paint: Paint
  /** The name column's label ("Chassis", "Pattern"). */
  nameLabel: string
  /** How many the list holds, beside its title on the tab. */
  count?: number
  columns: readonly LedgerColumn[]
  rows: readonly LedgerRow[]
  /** The list's sources, once: the cite cut-out on the foot band. */
  foot?: ReactNode
  sort?: LedgerSort
  /** With it, a column's label sorts by that column (`name` for the names). */
  onSort?: (key: string) => void
  /** Names the table for a screen reader. */
  label: string
}) {
  const stamp = (key: string, text: string, title?: string) => {
    const mark = (
      <Badge shape="stamp" size="mini" surface="solid">
        {text}
        {sort?.key === key && (
          <span aria-hidden="true" className="su-ledger__arrow">
            {sort.descending ? '▼' : '▲'}
          </span>
        )}
      </Badge>
    )
    return onSort ? (
      <button
        type="button"
        className="su-ledger__sort"
        title={title}
        aria-label={`Sort by ${title ?? text}`}
        onClick={() => onSort(key)}
      >
        {mark}
      </button>
    ) : (
      <span title={title}>{mark}</span>
    )
  }
  const ariaSort = (key: string) =>
    sort?.key === key ? (sort.descending ? 'descending' : 'ascending') : undefined
  return (
    <Box frameColor={paint.background} body="flush" className="su-ledger">
      <table className="su-ledger__table" aria-label={label}>
        <thead>
          <tr
            className={cn('su-ledger__head', grainClass(paint.grain))}
            data-grain={paint.grain}
            style={{ backgroundColor: paint.background, color: paint.color }}
          >
            <th scope="col" aria-sort={ariaSort('name')}>
              {/* The title's cut-out: the Compact head's paper tab. */}
              <span className="su-ledger__title-line">
                <span className="su-entity-compact__notch">
                  {onSort ? (
                    <button
                      type="button"
                      className="su-ledger__sort su-entity-compact__title"
                      aria-label={`Sort by ${nameLabel}`}
                      onClick={() => onSort('name')}
                    >
                      {nameLabel}
                      {sort?.key === 'name' && (
                        <span aria-hidden="true" className="su-ledger__arrow">
                          {sort.descending ? '▼' : '▲'}
                        </span>
                      )}
                    </button>
                  ) : (
                    <span className="su-entity-compact__title">{nameLabel}</span>
                  )}
                  {count != null && <span className="su-ledger__count">{count}</span>}
                </span>
              </span>
            </th>
            {columns.map((column) => (
              <th
                key={column.key}
                scope="col"
                data-kind={column.kind}
                data-phone={column.phone || undefined}
                aria-sort={ariaSort(column.key)}
              >
                {stamp(column.key, column.label, column.title)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              <th scope="row">
                <span className="su-ledger__name-line">
                  <span className="su-ledger__name">
                    <Mention entityRef={row.entityRef}>{row.name}</Mention>
                  </span>
                  {row.stamp}
                </span>
              </th>
              {columns.map((column, index) => (
                <td
                  key={column.key}
                  data-kind={column.kind}
                  data-phone={column.phone || undefined}
                  data-empty={!row.cells[index] || undefined}
                  title={column.kind === 'quiet' ? row.cells[index] : undefined}
                >
                  {row.cells[index] || '—'}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {foot && (
        <EntityCardIdentityFooter
          provenance={undefined}
          credit={foot}
          size="mini"
          band={{
            bandColor: paint.background,
            onBand: paint.color === 'var(--color-paper)' ? 'paper' : 'ink',
          }}
          grain={paint.grain}
        />
      )}
    </Box>
  )
}
