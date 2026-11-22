/**
 * The Ledger's open form (ledger.md L1): `<Ledger open …>` renders this. The
 * head is the Ledger's own (L2, L5): an ink strip with the title on a paper
 * cut-out at its left and the column labels reversed on it; the rows band
 * paper and cream (L3) on hairlines; a row with rules opens in place under
 * itself (its chevron, `aria-expanded`), its columns holding still. No frame
 * and no foot bar: the strip is the only paint, so a page of six tables reads
 * as six lists, not six boxes.
 *
 * One table for a section. Its head row IS the section's head: the label on
 * its cut-out, its tally beside it, the column labels on the strip. A
 * sub-group (Turn, Short, a tree) is a small label on a hairline. A row is
 * one thing: its name (a `Mention`, so it opens its Page and Peeks its whole
 * card), its one stamp, then its figures in fixed tabular columns; the line
 * under it is what it does.
 */

import { ChevronDown } from 'lucide-react'
import { Fragment, useContext, useId, useState } from 'react'
import * as tokens from '../../design/tokens'
import { cn } from '../../lib/cn'
import { entityCopy } from '../../messages/components-entity'
import { capsLabel } from '../atoms/capsLabel'
import { InlineRef } from '../atoms/InlineRef'
import type { SlabCount } from '../atoms/slabSummary'
import { StatMeaningContext } from '../atoms/statMeaning'
import { CostMark } from './CostMark'
import { Mention } from './forms/Mention'
import type { LedgerColumn, LedgerGroup, LedgerOpenProps, LedgerRow } from './Ledger'

/** A caps label: the condensed face in capitals (ruleset §3.12). */
const CAPS = capsLabel({ weight: 'inherit', tracking: 'inherit' })

function Row({
  row,
  columns,
  span,
  band,
  gutter,
  whole,
}: {
  row: LedgerRow
  columns: readonly LedgerColumn[]
  span: number
  /** Its rules stand open, with no opener (the Ledger's `whole`). */
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
                <Mention entityRef={row.entityRef} goes>
                  {row.name}
                </Mention>
              ) : row.href ? (
                <InlineRef href={row.href}>{row.name}</InlineRef>
              ) : (
                row.name
              )}
            </span>
            {row.meta && <span className={cn('su-open__meta', CAPS)}>{row.meta}</span>}
            {row.stamp && <span className="su-open__state">{row.stamp}</span>}
            {row.controls && <span className="su-open__controls">{row.controls}</span>}
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
  group: LedgerGroup
  columns: readonly LedgerColumn[]
  span: number
  gutter: boolean
  whole: boolean
}) {
  const [open, setOpen] = useState(group.fold !== 'closed')
  return (
    <tbody>
      {group.label !== undefined && (
        <tr className={cn('su-open__group', CAPS)}>
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

export function LedgerOpen({
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
}: LedgerOpenProps) {
  const span = columns.length + 1
  const tallies = tally === undefined ? [] : Array.isArray(tally) ? tally : [tally as SlabCount]
  const filled = groups.filter((group) => group.rows.length > 0)
  const gutter =
    !whole && filled.some((group) => group.rows.some((row) => row.detail !== undefined))
  // The table is named by its title, as a screen reader lists it.
  const titleId = useId()
  const meaning = useContext(StatMeaningContext)
  return (
    // `data-form`: a list's form, the same in Read and Edit (R11).
    <table className={cn('su-open', className)} aria-labelledby={titleId} data-form="ledger">
      <thead className={CAPS}>
        <tr>
          <th scope="col">
            {/* The tab is its section's head (L2): a Slab's row, as the outline reads it. */}
            <span className="su-open__title" data-slab="">
              <Heading id={titleId} className={cn('su-rule-head__label', CAPS)}>
                {title}
              </Heading>
              {tallies.length > 0 && (
                <span className="su-rule-head__tallies">
                  {tallies.map((entry) => (
                    <span
                      key={entry.label}
                      className={cn('su-rule-head__tally', CAPS)}
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
              {note && <span className={cn('su-rule-head__note', CAPS)}>{note}</span>}
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
              {/* A paper cut-out on the strip's foot, as the title's tab (L2). */}
              <span className="su-open__col-tab">
                {column.key === 'cost' && <CostMark />}
                {/* Its stamp opens what it means, where the sheet says how (r5 C8). */}
                {meaning && column.statKey ? meaning(column.statKey, column.label) : column.label}
              </span>
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
