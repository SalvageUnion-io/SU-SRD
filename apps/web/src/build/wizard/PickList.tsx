// MOCK (Working Manual, the blend of the book's table and the pick Compacts):
// the wizard's picker as ONE frame in the kind's band paint. Its head is one
// strip in the band colour: the picker's title notched into its foot on the
// site's paper cut-out (the Compact head's own `.su-entity-compact__notch` and
// `__title`), the column labels right of it as the site's ink stamps, and what
// the pick asks ("Choose 1") as a small stamp at the strip's end. Each option
// is a Mini-height select row, its name in the caps face, its values plain
// condensed tabular numerals in fixed columns (ruleset §2.6), the rows banded
// paper and page ground. The picked row is set in ink (as a rolled row is),
// its name on a paper cut-out, never a left rail (§3.10). Its foot is the
// card's own (`EntityCardIdentityFooter`): the source on a paper cut-out
// hanging from the foot band. Each row is a native radio, so the group keeps
// its arrow keys. Its look is `.su-wiz-pick*` in `styles/build/wizard.css`.
import type { ReactNode } from 'react'
import { useId } from 'react'
import { Badge, capsLabel } from '../../components/index'
import { EntityCardIdentityFooter } from '../../components/referenceEntity/card/EntityCardIdentityFooter'
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
  /** The picker's title, on the head's cut-out; it names the radio group too. */
  title: string
  /** What the pick asks, the head strip's last stamp (`Choose 1`, `Optional`). */
  note?: string
  rows: readonly T[]
  rowKey: (row: T) => string
  rowName: (row: T) => string
  columns: readonly PickColumn<T>[]
  /** The picked row's key. */
  selected: string | undefined
  onSelect: (key: string) => void
  /** The foot: the source on its cut-out, a plain fact left of it (`COSTS | …`). */
  foot?: { cite: string; meta?: { label: string; value: string } }
}

const TITLE_CAPS = capsLabel({ weight: 'inherit' })

/** The foot band wears the frame's paint, its type ink (as a mech or pilot card's). */
const FOOT_BAND = { onBand: 'ink', bandColor: 'var(--tone)' } as const

export function PickList<T>({
  title,
  note,
  rows,
  rowKey,
  rowName,
  columns,
  selected,
  onSelect,
  foot,
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
      aria-label={title}
      className={cn('su-wiz-pick', hasText && 'su-wiz-pick--text')}
      // The one track list every line shares (the lines are subgrids): the name,
      // then a track a column, a text column taking the room left.
      style={{
        gridTemplateColumns: [
          hasText ? 'max-content' : 'minmax(0, 1fr)',
          ...columns.map((column) => (column.text ? 'minmax(0, 1fr)' : 'max-content')),
        ].join(' '),
      }}
    >
      {/* The band: the title's cut-out on its foot, the pick's ask at its end. */}
      <div className="su-wiz-pick__band">
        <span className="su-entity-compact__notch su-wiz-pick__tab">
          <span className={cn('su-entity-compact__title', TITLE_CAPS)}>{title}</span>
        </span>
        {note && (
          <Badge shape="stamp" size="mini" className="su-wiz-pick__note">
            {note}
          </Badge>
        )}
      </div>
      {/* The columns' stamps: on the band right of the tab, or, short of room
          (a phone), the paper line under it, as a Compact's chips drop. */}
      <div aria-hidden="true" className="su-wiz-pick__cols">
        <span className="su-wiz-pick__cell su-wiz-pick__cell--name" />
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
              <span className="su-wiz-pick__name">{rowName(row)}</span>
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
      {foot && (
        <div className="su-wiz-pick__foot">
          <EntityCardIdentityFooter
            provenance={undefined}
            size="compact"
            band={FOOT_BAND}
            credit={foot.cite}
            {...(foot.meta ? { footMeta: [foot.meta] } : {})}
          />
        </div>
      )}
    </div>
  )
}
