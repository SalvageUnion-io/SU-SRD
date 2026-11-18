// The LEDGER (docs/design-system: L1 to L9), a list of entities to compare or
// pick from as ONE framed block: the Compact's frame in the list's band colour,
// one column-head strip on the band carrying the column labels as stamps, then
// a Mini-height line per entity: its name (the link and Peek, a `Mention`), an
// optional stamp (TL, Starting), and its values in fixed columns, in the stat
// order (ruleset 2.6). Rows band paper and cream as the roll table's do. Its
// cut-outs are the app's own: the list's title on the Compact head's paper tab
// (`.su-entity-compact__notch` + `__title`), notched into the head strip's
// foot, and its sources on the card foot's cut-out (`EntityCardIdentityFooter`
// on the band, `--su-foot-ground`). Styles: `styles/partials/ledger.css`.
import type { MouseEvent, ReactNode } from 'react'
import { Fragment, useId } from 'react'
import type { EntityRef } from 'salvageunion-reference'
import { cn } from '../../lib/cn'
import { Badge } from '../atoms/Badge'
import { InlineRef } from '../atoms/InlineRef'
import { Box } from '../containers/Box'
import { grainClass } from '../referenceEntity/card/cardGrain'
import { EntityCardIdentityFooter } from '../referenceEntity/card/EntityCardIdentityFooter'
import type { CardFootMeta } from '../referenceEntity/card/referenceEntityCardTypes'
import { useEntitySurface } from './entitySurfaceContext'
import { Mention } from './forms/Mention'
import type { Paint } from './parts/paint'
import { paintFor } from './parts/paint'

export type LedgerColumn = {
  key: string
  label: string
  /** The label spelled out, on hover and for a screen reader. */
  title?: string
  /**
   * `figure`: a numeral, centred in its column; `text`: a word; `quiet`: one
   * line of words, muted, taking the room left; `line`: body copy that takes
   * the room left and wraps.
   */
  kind: 'figure' | 'text' | 'quiet' | 'line'
  /** Kept on a phone. */
  phone?: boolean
}

export type LedgerRow = {
  id: string
  name: string
  /** The entity the name links to and Peeks. */
  entityRef: EntityRef | undefined
  /** Where the name links when it is no reference entity's Page (a shared pattern, a search result, a player's own sheet). */
  href?: string
  /** Attributes for that link: a search result's `role="option"`. */
  linkAttrs?: Record<string, unknown>
  /** The row's one stamp, at the name cell's end (`TL | 1`, Starting). */
  stamp?: ReactNode
  /** One per column, in order; an empty cell draws `—`. */
  cells: readonly ReactNode[]
  /** The row's last cell: its menu, its count or its stepper. */
  trailing?: ReactNode
  /** The pick's marks under the name (`CHOSEN | Energy`, hard rule R60). */
  under?: ReactNode
  /**
   * In select: whether the row is inked. Left out, the selected row is. A count
   * pick sets it (a row with a copy), and the selected row is then the one
   * the detail shows, ringed.
   */
  picked?: boolean
  /** In select: why the row cannot be picked now; it wears the one dim and says why on a pointer. */
  blocked?: string
  /** In select: the row's card, opened under its line while it is selected. */
  detail?: ReactNode
}

/** A picker (L7): each row a radio of one group. */
export type LedgerSelect = {
  /** The selected row's id. */
  selected: string | undefined
  onSelect: (id: string) => void
  /** `always`: a row's detail opens under its line at every width; `narrow` (the default): only where no column stands beside the list. */
  detailAt?: 'narrow' | 'always'
}

export type LedgerSort = { key: string; descending: boolean }

/** A cell with nothing to say draws `—` (L5); a `0` is a value. */
const isEmpty = (cell: ReactNode) =>
  cell === '' || cell === null || cell === undefined || cell === false

/** A quiet line is cut short on its one line: its words are its hover title. */
function cellTitle(column: LedgerColumn, cell: ReactNode): string | undefined {
  return column.kind === 'quiet' && typeof cell === 'string' ? cell : undefined
}

export function Ledger({
  tone = 'ink',
  paint: paintProp,
  nameLabel,
  count,
  columns,
  rows,
  foot,
  sort,
  mark,
  onSort,
  label,
  action,
  empty,
  total,
  trailingLabel,
  select,
  note,
  footMeta,
}: {
  /** The band's tone on the colour map (a kind's, `ink` for a mixed list): the frame's colour and the head strip's. */
  tone?: string
  /** The band's paint, for a list whose band is no tone token's (a wizard's `--tone`). It replaces `tone`. */
  paint?: Paint
  /** The name column's label ("Chassis", "Pattern"). */
  nameLabel: string
  /** How many the list holds, beside its title on the tab; a node for a used/max ("7/7"). */
  count?: ReactNode
  columns: readonly LedgerColumn[]
  rows: readonly LedgerRow[]
  /** The list's sources, once: the cite cut-out on the foot band. */
  foot?: ReactNode
  sort?: LedgerSort
  /** A stamp beside the title tab, on the band (HOMEBREW). */
  mark?: ReactNode
  /** With it, a column's label sorts by that column (`name` for the names). */
  onSort?: (key: string) => void
  /** Names the table for a screen reader. */
  label: string
  /** At the head strip's end, on its own paper cut-out: the list's one make (`+ New pilot`). */
  action?: ReactNode
  /** Said in the body when the list holds nothing (`No pilots yet.`). */
  empty?: string
  /** The list's sums, a last line set in ink (`Total`, one cell a column). */
  total?: { label: string; cells: readonly ReactNode[] }
  /** The trailing cell's stamp (`Qty`); with it every row has a trailing cell. */
  trailingLabel?: string
  /** With it the Ledger is a picker (L7): a row's name is its radio, not a link. */
  select?: LedgerSelect
  /** The head strip's last mark: what a pick asks (`Choose 1`) or how much of its budget is spent. */
  note?: ReactNode
  /** A plain fact left of the sources on the foot band (`COSTS | its Salvage Value`). */
  footMeta?: CardFootMeta[]
}) {
  const group = useId()
  const surface = useEntitySurface()
  const paint = paintProp ?? paintFor(tone, { texture: surface.texture })
  const hasTrailing =
    action != null ||
    note != null ||
    trailingLabel !== undefined ||
    rows.some((row) => row.trailing != null)
  const span = columns.length + 1 + (hasTrailing ? 1 : 0)
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
  // A phone keeps the columns marked for it; a list with none keeps its first
  // quiet line instead, dropped under the name.
  const phoneLine = columns.some((column) => column.phone)
    ? undefined
    : columns.find((column) => column.kind === 'quiet' || column.kind === 'line')?.key
  const ariaSort = (key: string) =>
    sort?.key === key ? (sort.descending ? 'descending' : 'ascending') : undefined
  return (
    <Box frameColor={paint.background} body="flush" className="su-ledger">
      <table
        className="su-ledger__table"
        aria-label={label}
        data-phone-line={phoneLine ? '' : undefined}
      >
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
                {mark}
              </span>
            </th>
            {columns.map((column) => (
              <th
                key={column.key}
                scope="col"
                data-kind={column.kind}
                data-phone={column.phone || undefined}
                data-line={column.key === phoneLine || undefined}
                aria-sort={ariaSort(column.key)}
              >
                {stamp(column.key, column.label, column.title)}
              </th>
            ))}
            {hasTrailing && (
              <th scope="col" data-kind="trailing" data-phone="">
                <span className="su-ledger__trailing-line">
                  {typeof note === 'string' ? (
                    <Badge shape="stamp" size="mini" surface="solid">
                      {note}
                    </Badge>
                  ) : (
                    note
                  )}
                  {action ? (
                    <span className="su-ledger__action">{action}</span>
                  ) : (
                    trailingLabel && stamp('trailing', trailingLabel)
                  )}
                </span>
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => {
            const selected = select?.selected === row.id
            const picked = select ? (row.picked ?? selected) : false
            return (
              <Fragment key={row.id}>
                <tr
                  data-band={index % 2 === 1 || undefined}
                  data-picked={picked || undefined}
                  data-focused={(selected && row.picked !== undefined) || undefined}
                  data-blocked={(row.blocked !== undefined && !picked) || undefined}
                  title={row.blocked}
                  {...(select
                    ? {
                        // The whole line picks; its own controls (the radio's label, a stepper) act for themselves.
                        onClick: (event: MouseEvent<HTMLTableRowElement>) => {
                          if (!(event.target as Element).closest('label, button, a, input'))
                            select.onSelect(row.id)
                        },
                      }
                    : {})}
                >
                  <th scope="row">
                    <span className="su-ledger__name-line">
                      {select ? (
                        <label className="su-ledger__pick">
                          <input
                            type="radio"
                            name={group}
                            className="su-sr-only"
                            checked={selected}
                            onChange={() => select.onSelect(row.id)}
                          />
                          <span className="su-ledger__name">{row.name}</span>
                        </label>
                      ) : (
                        <span className="su-ledger__name">
                          {row.href ? (
                            <InlineRef href={row.href} {...row.linkAttrs}>
                              {row.name}
                            </InlineRef>
                          ) : (
                            <Mention entityRef={row.entityRef}>{row.name}</Mention>
                          )}
                        </span>
                      )}
                      {row.stamp}
                    </span>
                    {row.under && <span className="su-ledger__under">{row.under}</span>}
                  </th>
                  {columns.map((column, cell) => (
                    <td
                      key={column.key}
                      data-kind={column.kind}
                      data-phone={column.phone || undefined}
                      data-line={column.key === phoneLine || undefined}
                      data-empty={isEmpty(row.cells[cell]) || undefined}
                      title={cellTitle(column, row.cells[cell])}
                    >
                      {isEmpty(row.cells[cell]) ? '—' : row.cells[cell]}
                    </td>
                  ))}
                  {hasTrailing && (
                    <td data-kind="trailing" data-phone="">
                      {row.trailing}
                    </td>
                  )}
                </tr>
                {select && selected && row.detail && (
                  <tr className="su-ledger__detail" data-at={select.detailAt ?? 'narrow'}>
                    <td colSpan={span}>{row.detail}</td>
                  </tr>
                )}
              </Fragment>
            )
          })}
          {rows.length === 0 && empty && (
            <tr className="su-ledger__empty">
              <td colSpan={span}>{empty}</td>
            </tr>
          )}
        </tbody>
        {total && rows.length > 0 && (
          <tfoot>
            <tr className="su-ledger__total">
              <th scope="row">{total.label}</th>
              {columns.map((column, index) => (
                <td key={column.key} data-kind={column.kind} data-phone={column.phone || undefined}>
                  {total.cells[index]}
                </td>
              ))}
              {hasTrailing && <td data-kind="trailing" data-phone="" />}
            </tr>
          </tfoot>
        )}
      </table>
      {(foot || footMeta) && (
        <EntityCardIdentityFooter
          provenance={undefined}
          credit={foot}
          {...(footMeta ? { footMeta } : {})}
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
