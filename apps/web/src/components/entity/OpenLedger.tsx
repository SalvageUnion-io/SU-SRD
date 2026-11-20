/**
 * OpenLedger — The Ledger, unframed.
 *
 * Best variant: the head is the Ledger's own (ledger.md L2, L5): an ink strip
 * with the title on a paper cut-out at its left and the column labels
 * reversed on it; the rows band paper and cream (L3) on hairlines; a row with
 * rules opens in place under itself (its chevron, `aria-expanded`), its
 * columns holding still. No frame and no foot bar: the strip is the only
 * paint, so a page of six tables reads as six lists, not six boxes.
 *
 * (From the sheet variant:) rows, not cards.
 *
 * One table for a section. Its head row IS the section's head: the label on
 * its rule, its tally beside it, and the column labels at the rule's end
 * (small caps, not stamps), so a column is named once for every sub-group
 * under it. A sub-group (Turn, Short, a tree) is a small label on a hairline.
 * A row is one thing: its name (a `Mention`, so it opens its Page and Peeks
 * its whole card), what marks it on this sheet, then its figures in fixed
 * tabular columns; the line under it is what it does, two lines at most.
 *
 * It is `Ledger`'s open form (ledger.md L1, L2): the same rows and columns
 * with no frame and no painted head strip, so a sheet's lists read alike at
 * every width.
 */

import { ChevronDown } from 'lucide-react'
import type { ElementType, ReactNode } from 'react'
import { Fragment, useId, useState } from 'react'
import type { EntityRef } from 'salvageunion-reference'
import * as tokens from '../../design/tokens'
import { cn } from '../../lib/cn'
import { entityCopy } from '../../messages/components-entity'
import type { CSSVarStyle } from '../../styles/cssVars'
import { capsLabel } from '../atoms/capsLabel'
import { InlineRef } from '../atoms/InlineRef'
import type { SlabCount } from '../atoms/slabSummary'
import { Mention } from './forms/Mention'

/** A caps label: the condensed face in capitals (ruleset §3.12). */
const CAPS = capsLabel({ weight: 'inherit', tracking: 'inherit' })

export type OpenColumn = {
  key: string
  /** The column's label on the rule: `RNG`, `DMG`. */
  label: string
  /** Its words in full, for the hover and assistive tech. */
  title?: string
  /** `figure` (default): a centred tabular figure. `text`: words, left. */
  kind?: 'figure' | 'text'
  /** Kept on a phone; the others give way to the name. */
  phone?: boolean
  /** Its values label themselves (a cost badge reads "2 AP"), so the head prints no label; the label is still read. A column keyed `cost` is quiet unless it says otherwise (L15). */
  quiet?: boolean
}

export type OpenRow = {
  id: string
  name: ReactNode
  /** The entity the row names: its name opens the Page and Peeks the card. */
  entityRef?: EntityRef | undefined
  /** Where the row's name goes, when it is not a reference entity (a sheet). */
  href?: string | undefined
  /** Before the name: a level numeral, a Tech Level swatch. */
  lead?: ReactNode
  /** After the name, quiet caps: its traits, where it comes from. */
  meta?: ReactNode
  /** What it is on this sheet: a stamp (Damaged), its Uses. */
  state?: ReactNode
  /** One per column, in order; `''` or `null` prints the empty mark. */
  cells: readonly ReactNode[]
  /** The line under the row: what it does. */
  under?: ReactNode
  /** Greyed: an ability not taken, a destroyed item. */
  dim?: boolean
  /** With it the row opens: its rules in full, under it. */
  detail?: ReactNode
  /** The opener's name: "Command Bay rules". */
  detailLabel?: string
  /** Starts open (the pilot's taken abilities read without a press). */
  defaultOpen?: boolean
}

type OpenGroup = {
  key: string
  /** The sub-group's label; absent, the rows follow the head. */
  label?: ReactNode
  /** A quiet note at the label's line end: a tree's track. */
  note?: ReactNode
  rows: readonly OpenRow[]
  /**
   * The sub-group folds, and starts shut: what every unit of the kind has
   * (a pilot's Generic abilities) stays a line until it is asked for.
   */
  fold?: 'closed'
}

type OpenLedgerProps = {
  title: ReactNode
  /** The title's element: the section's heading. */
  as?: ElementType
  /** The section's tally, as a Slab's value count reads under the rule look. */
  tally?: SlabCount | readonly SlabCount[]
  /** A quiet word at the title's end instead of a tally. */
  note?: ReactNode
  /** The section's controls, at the head's end (its "+ New…", Manage). */
  actions?: ReactNode
  /** Said before the rows: an error, a hint. */
  lead?: ReactNode
  columns: readonly OpenColumn[]
  groups: readonly OpenGroup[]
  /** Said when there is nothing to list. */
  empty?: string
  /** The books these rows are printed in: the foot's cut-out, bottom right. */
  cite?: ReactNode
  /**
   * Every row's rules stand open, with no opener: a reference Page shows its
   * whole self, nothing folded (R43, R44).
   */
  whole?: boolean
  className?: string
}

function Row({
  row,
  columns,
  span,
  band,
  gutter,
  whole,
}: {
  row: OpenRow
  columns: readonly OpenColumn[]
  span: number
  /** Its rules stand open, with no opener (`OpenLedger`'s `whole`). */
  whole: boolean
  /** Another row of the ledger opens: this one keeps the opener's column. */
  gutter: boolean
  /** The cream band of the zebra (every second row of its group). */
  band: boolean
}) {
  // Until it is pressed a row is open where it starts open: derived, not
  // stored, so a row whose rules arrive after its first render still opens.
  const [pressed, setPressed] = useState<boolean | null>(null)
  const starts = row.defaultOpen === true || whole
  const open = row.detail !== undefined && (whole || (pressed ?? starts))
  const setOpen = (next: (value: boolean) => boolean) => setPressed(next(open))
  const panel = useId()
  const banded = band ? '' : undefined
  const opens = row.detail !== undefined
  return (
    <Fragment>
      <tr
        className="su-open__row"
        data-dim={row.dim ? '' : undefined}
        data-band={banded}
        data-opens={opens || gutter ? '' : undefined}
        data-open={opens && open ? '' : undefined}
      >
        <th scope="row">
          <span className="su-open__name-line">
            {row.detail !== undefined && !whole && (
              <button
                type="button"
                className="su-open__toggle"
                aria-expanded={open}
                aria-controls={panel}
                aria-label={
                  row.detailLabel ??
                  entityCopy('rowRules', { name: typeof row.name === 'string' ? row.name : '' })
                }
                onClick={() => setOpen((value) => !value)}
              >
                <ChevronDown aria-hidden="true" size={tokens.iconSize.mini} />
              </button>
            )}
            {row.detail === undefined && gutter && (
              <span className="su-open__toggle-gap" aria-hidden="true" />
            )}
            {row.lead !== undefined && <span className="su-open__lead">{row.lead}</span>}
            <span className="su-open__name">
              {row.entityRef ? (
                <Mention entityRef={row.entityRef}>{row.name}</Mention>
              ) : row.href ? (
                <InlineRef href={row.href}>{row.name}</InlineRef>
              ) : (
                row.name
              )}
            </span>
            {row.meta && <span className={cn('su-open__meta', CAPS, CAPS)}>{row.meta}</span>}
            {row.state && <span className="su-open__state">{row.state}</span>}
          </span>
        </th>
        {columns.map((column, index) => {
          const cell = row.cells[index]
          const blank = cell === undefined || cell === null || cell === ''
          return (
            <td
              key={column.key}
              data-kind={column.kind ?? 'figure'}
              data-phone={column.phone ? '' : undefined}
              data-empty={blank ? '' : undefined}
            >
              {blank ? '—' : cell}
            </td>
          )
        })}
      </tr>
      {row.under && (
        <tr className="su-open__under" data-band={banded}>
          <td colSpan={span}>{row.under}</td>
        </tr>
      )}
      {row.detail !== undefined && (
        <tr
          className="su-open__detail"
          id={whole ? undefined : panel}
          hidden={!open}
          data-band={banded}
        >
          <td colSpan={span}>
            {open ? <div className="su-open__detail-body">{row.detail}</div> : null}
          </td>
        </tr>
      )}
    </Fragment>
  )
}

function Group({
  group,
  columns,
  span,
  gutter,
  whole,
}: {
  group: OpenGroup
  columns: readonly OpenColumn[]
  span: number
  gutter: boolean
  whole: boolean
}) {
  const [open, setOpen] = useState(group.fold !== 'closed')
  return (
    <tbody>
      {group.label !== undefined && (
        <tr className={cn('su-open__group', CAPS, CAPS)}>
          <th colSpan={span} scope="rowgroup">
            <span className="su-open__group-line">
              {group.fold ? (
                <button
                  type="button"
                  className="su-open__group-fold"
                  aria-expanded={open}
                  onClick={() => setOpen((value) => !value)}
                >
                  <ChevronDown aria-hidden="true" size={tokens.iconSize.mini} />
                  {group.label}
                </button>
              ) : (
                <span>{group.label}</span>
              )}
              <span className="su-open__group-note">
                {group.fold && !open ? group.rows.length : group.note}
              </span>
            </span>
          </th>
        </tr>
      )}
      {open &&
        group.rows.map((row, index) => (
          <Row
            key={row.id}
            row={row}
            columns={columns}
            span={span}
            band={index % 2 === 1}
            gutter={gutter}
            whole={whole}
          />
        ))}
    </tbody>
  )
}

export function OpenLedger({
  title,
  as: Heading = 'h3',
  tally,
  note,
  actions,
  lead,
  columns,
  groups,
  empty,
  cite,
  whole = false,
  className,
}: OpenLedgerProps) {
  const span = columns.length + 1
  const tallies = tally === undefined ? [] : Array.isArray(tally) ? tally : [tally as SlabCount]
  const filled = groups.filter((group) => group.rows.length > 0)
  const gutter =
    !whole && filled.some((group) => group.rows.some((row) => row.detail !== undefined))
  // The table is named by its title, as a screen reader lists it.
  const titleId = useId()
  return (
    <table className={cn('su-open', className)} aria-labelledby={titleId}>
      <thead className={CAPS}>
        <tr>
          <th scope="col">
            {/* The tab is its section's head (L2): a Slab, as the page's outline reads it. */}
            <span className="su-open__title" data-slab="">
              <Heading id={titleId} className={cn('su-rule-head__label', CAPS, CAPS)}>
                {title}
              </Heading>
              {tallies.length > 0 && (
                <span className="su-rule-head__tallies">
                  {tallies.map((entry) => (
                    <span
                      key={entry.label}
                      className={cn('su-rule-head__tally', CAPS, CAPS)}
                      data-state={entry.state === 'critical' ? 'critical' : undefined}
                      title={entry.title}
                    >
                      <b>{entry.value}</b>
                      {entry.max !== undefined && <i>/{entry.max}</i>}
                      <small>{entry.label}</small>
                      {entry.note != null && <small>{entry.note}</small>}
                    </span>
                  ))}
                </span>
              )}
              {note && <span className={cn('su-rule-head__note', CAPS, CAPS)}>{note}</span>}
              {actions && <div className="su-rule-head__actions">{actions}</div>}
            </span>
          </th>
          {columns.map((column) => (
            <th
              key={column.key}
              scope="col"
              data-col=""
              data-kind={column.kind ?? 'figure'}
              data-phone={column.phone ? '' : undefined}
              title={column.title}
            >
              {(column.quiet ?? column.key === 'cost') ? (
                <span className="su-sr-only">{column.label}</span>
              ) : (
                column.label
              )}
            </th>
          ))}
        </tr>
      </thead>
      {lead !== undefined && lead !== null && (
        <tbody>
          <tr>
            <td colSpan={span}>
              <div className="su-open__lead-note">{lead}</div>
            </td>
          </tr>
        </tbody>
      )}
      {filled.length === 0 && empty ? (
        <tbody>
          <tr>
            <td colSpan={span}>
              <p className="su-open__empty">{empty}</p>
            </td>
          </tr>
        </tbody>
      ) : (
        filled.map((group) => (
          <Group
            key={group.key}
            group={group}
            columns={columns}
            span={span}
            gutter={gutter}
            whole={whole}
          />
        ))
      )}
      {cite && (
        <tfoot>
          <tr>
            <td colSpan={span}>
              <span className="su-open-cite">{cite}</span>
            </td>
          </tr>
        </tfoot>
      )}
    </table>
  )
}

/** A Tech Level as its swatch on the colour map. */
export function TechLevel({ level }: { level: number | string | undefined }) {
  if (level === undefined || level === '') return null
  const key = typeof level === 'number' ? level : String(level).toLowerCase()
  return (
    <span
      className="su-tl"
      // The dark swatches (TL 4 up) carry paper text.
      data-dark={typeof level === 'number' && level >= 4 ? '' : undefined}
      style={{ '--tl': `var(--color-tl-${key})` } as CSSVarStyle}
      title={entityCopy('techLevelN', { level: String(level) })}
    >
      {level}
    </span>
  )
}
