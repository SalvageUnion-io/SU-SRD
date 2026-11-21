// The LEDGER (docs/design-system: L1 to L9), the one table a list of entities
// to compare or pick from is. `open` renders its open form (`LedgerOpen`): a
// section's grouped rows that open in place, unframed. Otherwise it is ONE block: the Compact's frame in the list's band colour,
// one column-head strip on the band carrying the column labels as stamps, then
// a Mini-height line per entity: its name (the link and Peek, a `Mention`), an
// optional stamp (TL, Starting), and its values in fixed columns, in the stat
// order (ruleset 2.6). Rows band paper and cream as the roll table's do. Its
// cut-outs are the app's own: the list's title on the Compact head's paper tab
// (`.su-entity-compact__notch` + `__title`), notched into the head strip's
// foot, and its sources on the card foot's cut-out (`EntityCardIdentityFooter`
// on the band, `--su-foot-ground`). Styles: `styles/partials/ledger.css`.
import { ChevronDown, ChevronsUpDown, ChevronUp } from 'lucide-react'
import type { CSSProperties, ElementType, MouseEvent, ReactNode } from 'react'
import { Fragment, useId } from 'react'
import type { EntityRef } from 'salvageunion-reference'
import { iconSize } from '../../design/tokens'
import { cn } from '../../lib/cn'
import { entityCopy } from '../../messages/components-entity'
import { Badge } from '../atoms/Badge'
import { capsLabel } from '../atoms/capsLabel'
import { InlineRef } from '../atoms/InlineRef'
import type { SlabCount } from '../atoms/slabSummary'
import { Box } from '../containers/Box'
import { grainClass } from '../referenceEntity/card/cardGrain'
import { EntityCardIdentityFooter } from '../referenceEntity/card/EntityCardIdentityFooter'
import type { CardFootMeta } from '../referenceEntity/card/referenceEntityCardTypes'
import { CostMark } from './CostMark'
import { useEntitySurface } from './entitySurfaceContext'
import { Mention } from './forms/Mention'
import { LedgerOpen } from './LedgerOpen'
import type { Paint } from './parts/paint'
import { paintFor } from './parts/paint'
import { usePeekAttrs } from './peekContext'

export type LedgerColumn = {
  key: string
  /** Its stamp on the head strip: `RNG`, `DMG`. */
  label: string
  /** The label spelled out, on hover and for a screen reader. */
  title?: string
  /**
   * `figure` (the default): a numeral, centred in its column; `text`: a word;
   * `quiet`: one line of words, muted, taking the room left; `line`: body
   * copy that takes the room left and wraps.
   */
  kind?: 'figure' | 'text' | 'quiet' | 'line'
  /** Kept on a phone; the others give way to the name. */
  phone?: boolean
  /**
   * A column the list can spare (`data-spare`): a host whose frame runs
   * narrow drops it before the list runs wider than the frame (the Training
   * Bay's shelves, by their own width).
   */
  spare?: boolean
}

/** A name linked to an address of its own; it Peeks when the row names an entity (L4). */
function AddressedName({ row, href }: { row: LedgerRow; href: string }) {
  const peek = usePeekAttrs(row.entityRef)
  return (
    <InlineRef href={href} {...peek} {...row.linkAttrs}>
      {row.name}
    </InlineRef>
  )
}

export type LedgerRow = {
  id: string
  name: ReactNode
  /** The entity the name links to and Peeks. */
  entityRef?: EntityRef | undefined
  /** Where the name links when it is no reference entity's Page (a shared pattern, a search result, a player's own sheet). */
  href?: string | undefined
  /** Attributes for that link: a search result's `role="option"`. */
  linkAttrs?: Record<string, unknown>
  /** Open form: before the name, a level numeral or a Tech Level swatch. */
  lead?: ReactNode
  /** Open form: after the name, quiet caps (its traits, where it comes from). */
  meta?: ReactNode
  /** The row's one stamp, after the name (`TL | 1`, Starting, Damaged). */
  stamp?: ReactNode
  /** Open form: Edit's controls for the row, in place after its stamp (C8); Read gives none. */
  controls?: ReactNode
  /** One per column, in order; an empty cell draws `—`. */
  cells: readonly ReactNode[]
  /** The row's last cell: its menu, its count or its stepper. */
  trailing?: ReactNode
  /** The line under the name: the pick's marks (`CHOSEN | Energy`, R60), what it does. */
  under?: ReactNode
  /** Open form: greyed, an ability not taken or a destroyed item. */
  dim?: boolean
  /**
   * In select: whether the row is inked. Left out, the selected row is. A count
   * pick sets it (a row with a copy), and the selected row is then the one
   * the detail shows, ringed.
   */
  picked?: boolean
  /** In select: why the row cannot be picked now; it wears the one dim and says why on a pointer. */
  blocked?: string
  /**
   * Opened under the row's line: in select, its card while it is selected;
   * in the open form, its rules, behind its chevron.
   */
  detail?: ReactNode
  /** Open form: the opener's name ("Command Bay rules"). */
  detailLabel?: string
  /** Open form: the row starts open (the pilot's taken abilities read without a press). */
  defaultOpen?: boolean
}

/** An open form's sub-group (Turn, a tree): its rows under a small caps label. */
export type LedgerGroup = {
  key: string
  /** The sub-group's label; absent, the rows follow the head. */
  label?: ReactNode
  /** A quiet note at the label's line end: a tree's track. */
  note?: ReactNode
  rows: readonly LedgerRow[]
  /** The sub-group folds, and starts shut: what every unit of the kind has stays a line until asked for. */
  fold?: 'closed'
}

/** The open form's props: a section's grouped rows, unframed (L1). */
export type LedgerOpenProps = {
  open: true
  title: ReactNode
  /** The title's element: the section's heading. */
  as?: ElementType
  /** The section's tally, as a Slab's value count reads. */
  tally?: SlabCount | readonly SlabCount[]
  /** A quiet word at the title's end instead of a tally. */
  note?: ReactNode
  /** The section's controls, at the head's end (its "+ New…", Manage). */
  actions?: ReactNode
  /** Said before the rows: an error, a hint. */
  lead?: ReactNode
  columns: readonly LedgerColumn[]
  groups: readonly LedgerGroup[]
  /** Said when there is nothing to list. */
  empty?: string
  /** The books these rows are printed in: the foot's cut-out, bottom right. */
  cite?: ReactNode
  /** Every row's rules stand open, with no opener: a reference Page shows its whole self (R43, R44). */
  whole?: boolean
  className?: string
}

/** A picker (L7): each row a radio of one group. */
export type LedgerSelect = {
  /** The selected row's id. */
  selected: string | undefined
  onSelect: (id: string) => void
  /** `always`: a row's detail opens under its line at every width; `narrow` (the default): only where no column stands beside the list. */
  detailAt?: 'narrow' | 'always'
}

/** The condensed caps a title, a name and the sums' label wear (`capsLabel`, §3.12). */
const CAPS = capsLabel({ weight: 'inherit' })
const TITLE_LINE = cn('su-ledger__title-line', CAPS)
const NAME = cn('su-ledger__name', capsLabel({ size: 'lede', weight: 'inherit' }))

export type LedgerSort = { key: string; descending: boolean }

/** The sorted column's mark: a chevron at the Mini Size (K11), up for ascending. */
function sortMark(sort: LedgerSort): ReactNode {
  const Mark = sort.descending ? ChevronDown : ChevronUp
  return <Mark aria-hidden="true" size={iconSize.mini} className="su-ledger__arrow" />
}

/**
 * A sortable head's caret slot: the mark where the list sorts by this column,
 * else a muted up-and-down one in the same room, so no label widens when you
 * sort and every sortable label says it sorts.
 */
function sortSlot(sort: LedgerSort | undefined, key: string): ReactNode {
  return sort?.key === key ? (
    sortMark(sort)
  ) : (
    <ChevronsUpDown
      aria-hidden="true"
      size={iconSize.mini}
      className="su-ledger__arrow"
      data-idle=""
    />
  )
}

/** A cell with nothing to say draws `—` (L5); a `0` is a value. */
const isEmpty = (cell: ReactNode) =>
  cell === '' || cell === null || cell === undefined || cell === false

/** `[[Trait]]` markup in rules text (the dataset's own). */
const MARKUP = /\[\[([^\]]+)\]\]/g

/** A quiet line is cut short on its one line: its words, markup read as words, are its hover title. */
function cellTitle(column: LedgerColumn, cell: ReactNode): string | undefined {
  return column.kind === 'quiet' && typeof cell === 'string'
    ? cell.replace(MARKUP, '$1')
    : undefined
}

/**
 * A cell's words; rules text's `[[Trait]]` reads as its word, never as markup.
 * A quiet line, cut to its one line, holds no links; a Page's loadout line
 * links its parts (L4).
 */
function cellBody(cell: ReactNode): ReactNode {
  return typeof cell === 'string' ? cell.replace(MARKUP, '$1') : cell
}

/** A bare count of the rows (a number, or a numeral as text): the tab no longer prints it. */
function isTally(count: ReactNode): boolean {
  return typeof count === 'number' || (typeof count === 'string' && /^\d+$/.test(count.trim()))
}

type LedgerListProps = {
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
  /**
   * Drawn inside a listbox (search results): the table is presentation, so
   * each row's `role="option"` link sits directly in the listbox (SC 4.1.2).
   */
  presentation?: boolean
}

/** The indices of the columns some row fills: a list drops a column no row fills (L5). */
function filledColumns(columns: readonly LedgerColumn[], rows: readonly LedgerRow[]): number[] {
  const all = columns.map((_, index) => index)
  if (rows.length === 0) return all
  return all.filter((index) => rows.some((row) => !isEmpty(row.cells[index])))
}

const keep = <T,>(cells: readonly T[], kept: readonly number[]) =>
  kept.map((index) => cells[index] as T)

const keepRow = (row: LedgerRow, kept: readonly number[]): LedgerRow => ({
  ...row,
  cells: keep(row.cells, kept),
})

/** One Ledger (L1): the open form with `open`, else the list's one block. */
export function Ledger(props: LedgerListProps | LedgerOpenProps) {
  if ('open' in props) {
    const kept = filledColumns(
      props.columns,
      props.groups.flatMap((group) => group.rows)
    )
    if (kept.length === props.columns.length) return <LedgerOpen {...props} />
    return (
      <LedgerOpen
        {...props}
        columns={keep(props.columns, kept)}
        groups={props.groups.map((group) => ({
          ...group,
          rows: group.rows.map((row) => keepRow(row, kept)),
        }))}
      />
    )
  }
  const kept = filledColumns(props.columns, props.rows)
  if (kept.length === props.columns.length) return <LedgerList {...props} />
  const { total } = props
  return (
    <LedgerList
      {...props}
      columns={keep(props.columns, kept)}
      rows={props.rows.map((row) => keepRow(row, kept))}
      {...(total ? { total: { ...total, cells: keep(total.cells, kept) } } : {})}
    />
  )
}

function LedgerList({
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
  presentation = false,
}: LedgerListProps) {
  const group = useId()
  const surface = useEntitySurface()
  const paint = paintProp ?? paintFor(tone, { texture: surface.texture })
  const hasTrailing =
    action != null ||
    note != null ||
    trailingLabel !== undefined ||
    rows.some((row) => row.trailing != null)
  // With no column that takes the room left (a quiet line, a loadout), the
  // line's end does: the trailing cell, or an empty last one. The fixed
  // columns then stand beside the names instead of spreading across the frame.
  const roomy = columns.some((column) => column.kind === 'quiet' || column.kind === 'line')
  const hasFill = !roomy && !hasTrailing
  const span = columns.length + 1 + (hasTrailing || hasFill ? 1 : 0)
  const stamp = (key: string, text: string, title?: string) => {
    const mark = (
      <Badge shape="stamp" size="mini" surface="solid">
        {key === 'cost' && <CostMark />}
        {text}
        {onSort && sortSlot(sort, key)}
      </Badge>
    )
    return onSort ? (
      <button
        type="button"
        className="su-ledger__sort"
        title={title}
        // The name holds the visible label (SC 2.5.3): "Sort by SP (Structure Points)".
        aria-label={
          title && title !== text
            ? entityCopy('sortByTitled', { column: text, title })
            : entityCopy('sortBy', { column: text })
        }
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
        // The zebra tints from the list's own band.
        style={{ '--su-kind': paint.background } as CSSProperties}
        {...(presentation ? { role: 'presentation' } : { 'aria-label': label })}
        data-phone-line={phoneLine ? '' : undefined}
        data-trailing-fills={!roomy && hasTrailing ? '' : undefined}
      >
        <thead>
          <tr
            className={cn('su-ledger__head', grainClass(paint.grain))}
            data-grain={paint.grain}
            style={{ backgroundColor: paint.background, color: paint.color }}
          >
            <th scope="col" aria-sort={ariaSort('name')}>
              {/* The title's cut-out: the Compact head's paper tab. */}
              <span className={TITLE_LINE}>
                <span className="su-entity-compact__notch">
                  {onSort ? (
                    <button
                      type="button"
                      className="su-ledger__sort su-entity-compact__title"
                      aria-label={entityCopy('sortBy', { column: nameLabel })}
                      onClick={() => onSort('name')}
                    >
                      {nameLabel}
                      {sortSlot(sort, 'name')}
                    </button>
                  ) : (
                    <span className="su-entity-compact__title">{nameLabel}</span>
                  )}
                  {/* A plain row count is not printed (best, revision 8); a budget ("7/7") or a note is. */}
                  {count != null && !isTally(count) && (
                    <span className="su-ledger__count">{count}</span>
                  )}
                </span>
                {mark && <span className="su-ledger__mark">{mark}</span>}
              </span>
            </th>
            {columns.map((column) => (
              <th
                key={column.key}
                scope="col"
                data-kind={column.kind ?? 'figure'}
                data-phone={column.phone || undefined}
                data-spare={column.spare || undefined}
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
                  {/* A head with nothing to show still names its column (axe empty-table-header). */}
                  {note == null && !action && !trailingLabel && (
                    <span className="su-sr-only">{entityCopy('rowActions')}</span>
                  )}
                </span>
              </th>
            )}
            {hasFill && <td data-kind="fill" />}
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
                          if (!(event.target as Element).closest('label,button,a,input'))
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
                          <span className={NAME}>{row.name}</span>
                        </label>
                      ) : (
                        <span className={NAME}>
                          {row.href ? (
                            <AddressedName row={row} href={row.href} />
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
                      data-kind={column.kind ?? 'figure'}
                      data-phone={column.phone || undefined}
                      data-spare={column.spare || undefined}
                      data-line={column.key === phoneLine || undefined}
                      data-empty={isEmpty(row.cells[cell]) || undefined}
                      title={cellTitle(column, row.cells[cell])}
                    >
                      {isEmpty(row.cells[cell]) ? '—' : cellBody(row.cells[cell])}
                    </td>
                  ))}
                  {hasTrailing && (
                    <td data-kind="trailing" data-phone="">
                      {row.trailing}
                    </td>
                  )}
                  {hasFill && <td data-kind="fill" />}
                </tr>
                {select && selected && row.detail && (
                  <tr className="su-ledger__detail" data-at={select.detailAt ?? 'narrow'}>
                    <td colSpan={span}>
                      <div className="su-ledger__detail-body">{row.detail}</div>
                    </td>
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
              <th scope="row" className={CAPS}>
                {total.label}
              </th>
              {columns.map((column, index) => (
                <td
                  key={column.key}
                  data-kind={column.kind ?? 'figure'}
                  data-phone={column.phone || undefined}
                  data-spare={column.spare || undefined}
                >
                  {total.cells[index]}
                </td>
              ))}
              {hasTrailing && <td data-kind="trailing" data-phone="" />}
              {hasFill && <td data-kind="fill" />}
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
          wrap
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
