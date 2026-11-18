// MOCK (Working Manual, wave 2): the wizard's picker in the LEDGER form, the
// reading lane's `components/entity/Ledger.tsx` with a pick on each line. One
// frame in the kind's band paint. Its head is one strip in the band colour:
// the picker's title notched into its foot on the site's paper cut-out (the
// Compact head's own `.su-entity-compact__notch` and `__title`), the column
// labels right of it as mini ink stamps, and what the pick asks or how much of
// its budget is spent at the strip's end. Each option is a Mini-height row,
// banded paper and cream and hairline-ruled as the Ledger's, its name in the
// condensed caps face, its values plain condensed tabular numerals in fixed
// columns (ruleset §2.6), an empty cell a dash. The picked row is set in ink,
// its name on a paper cut-out, never a left rail (§3.10). Its foot is the
// card's own (`EntityCardIdentityFooter`): the source on a paper cut-out.
//
// Two picks:
//  - `radio` (the default): one of the rows; each row is a native radio.
//  - `count`: any number of copies of any rows. The row's radio is then what
//    the detail beside the list shows (`focused`), and its last cell is the
//    count's own stepper (ruleset §6.2). A row with a copy is set in ink.
//
// On a phone the columns marked `phone` stay and `detail` opens under the
// focused row, so the pick's card is never a screen away from its line.
// Its look is `.su-wiz-pick*` in `styles/build/wizard.css`.
import type { CSSProperties, ReactNode } from 'react'
import { useId } from 'react'
import { Badge, capsLabel, EntityCardIdentityFooter } from '../../components/index'
import { cn } from '../../lib/cn'

export type PickColumn<T> = {
  key: string
  /** The column's stamp (`SP`, `SYS`). */
  label: string
  /** The stamp's long name, for a pointer (`System slots`). */
  title?: string
  /** An empty value (`''`, null, undefined) draws a dash. */
  value: (row: T) => ReactNode
  /**
   * `figure` (the default): a numeral centred under its stamp. `text`: a word.
   * `quiet`: one muted line that takes the room left. `line`: body copy that
   * takes the room left and wraps.
   */
  kind?: 'figure' | 'text' | 'quiet' | 'line'
  /** Set apart from the columns before it (the cost after the stats). */
  apart?: boolean
  /** Kept on a phone. */
  phone?: boolean
}

type PickCount<T> = {
  /** The trailing column's stamp (`Qty`). */
  label: string
  value: (row: T) => number
  /** The most copies the row may hold now (its count plus what still fits). */
  max: (row: T) => number
  onChange: (row: T, next: number) => void
}

type PickListProps<T> = {
  /** The picker's title, on the head's cut-out; it names the radio group too. */
  title: string
  /** The head strip's last mark: what the pick asks (`Choose 1`) or its budget. */
  note?: ReactNode
  rows: readonly T[]
  rowKey: (row: T) => string
  rowName: (row: T) => string
  columns: readonly PickColumn<T>[]
  /** `radio`: the picked row's key. `count`: the row the detail shows. */
  selected: string | undefined
  onSelect: (key: string) => void
  /** With it the pick is a count a row, and `selected` is the focused row. */
  count?: PickCount<T>
  /** One stamp at the name's end (`Suggested`). */
  stamp?: (row: T) => ReactNode
  /** Under a picked row's name: its made choices (`CHOSEN | Energy`, R60). */
  under?: (row: T) => ReactNode
  /** Why a row cannot be picked now; it dims, and says why on a pointer. */
  disabled?: (row: T) => string | undefined
  /** The focused row's card, opened under its line on a phone. */
  detail?: (row: T) => ReactNode
  /** `always`: the detail opens under its line at every width (a row's own fields). */
  detailAt?: 'narrow' | 'always'
  /** The foot: the source on its cut-out, a plain fact left of it (`COSTS | …`). */
  foot?: { cite: string; meta?: { label: string; value: string } }
}

const TITLE_CAPS = capsLabel({ weight: 'inherit' })

/** The foot band wears the frame's paint, its type ink (as a mech or pilot card's). */
const FOOT_BAND = { onBand: 'ink', bandColor: 'var(--tone)' } as const

const isEmpty = (value: ReactNode) => value === '' || value === null || value === undefined

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
  detailAt = 'narrow',
  foot,
}: PickListProps<T>) {
  const group = useId()
  const wide = (column: PickColumn<T>) => column.kind === 'quiet' || column.kind === 'line'
  const track = (list: readonly PickColumn<T>[]) => {
    const hasWide = list.some(wide)
    return [
      hasWide ? 'max-content' : 'minmax(0, 1fr)',
      ...list.map((column) => (wide(column) ? 'minmax(0, 1fr)' : 'max-content')),
      ...(count ? ['max-content'] : []),
    ].join(' ')
  }
  const phoneColumns = columns.filter((column) => column.phone)
  const cellClass = (column: PickColumn<T>) =>
    cn(
      'su-wiz-pick__cell',
      `su-wiz-pick__cell--${column.kind ?? 'figure'}`,
      column.apart && 'su-wiz-pick__cell--apart',
      !column.phone && 'su-wiz-pick__cell--desk'
    )
  return (
    <div
      role="radiogroup"
      aria-label={title}
      className={cn('su-wiz-pick', columns.every(wide) && 'su-wiz-pick--text')}
      // The one track list every line shares (the lines are subgrids): the
      // name, a track a column, the count's stepper. A phone has its own.
      style={
        {
          '--su-pick-cols': track(columns),
          '--su-pick-cols-phone': track(phoneColumns),
        } as CSSProperties
      }
    >
      {/* The band: the title's cut-out on its foot, the pick's ask at its end. */}
      <div className="su-wiz-pick__band">
        <span className="su-entity-compact__notch su-wiz-pick__tab">
          <span className={cn('su-entity-compact__title', TITLE_CAPS)}>{title}</span>
        </span>
        {note !== undefined && (
          <span className="su-wiz-pick__note">
            {typeof note === 'string' ? (
              <Badge shape="stamp" size="mini">
                {note}
              </Badge>
            ) : (
              note
            )}
          </span>
        )}
      </div>
      {/* The columns' stamps: on the band right of the tab, or, short of room
          (a phone), the paper line under it, as a Compact's chips drop. */}
      <div aria-hidden="true" className="su-wiz-pick__cols">
        {/* The name track is at least the title tab wide: its unseen twin sizes it. */}
        <span className="su-wiz-pick__cell su-wiz-pick__cell--name su-wiz-pick__sizer">
          <span className="su-entity-compact__notch su-wiz-pick__tab">
            <span className={cn('su-entity-compact__title', TITLE_CAPS)}>{title}</span>
          </span>
        </span>
        {columns.map((column) => (
          <span key={column.key} title={column.title} className={cellClass(column)}>
            <Badge shape="stamp" size="mini">
              {column.label}
            </Badge>
          </span>
        ))}
        {count && (
          <span className="su-wiz-pick__cell su-wiz-pick__cell--count">
            <Badge shape="stamp" size="mini">
              {count.label}
            </Badge>
          </span>
        )}
      </div>
      {rows.map((row, index) => {
        const key = rowKey(row)
        const name = rowName(row)
        const isSelected = key === selected
        const copies = count?.value(row) ?? 0
        const picked = count ? copies > 0 : isSelected
        const blocked = disabled?.(row)
        const most = count?.max(row) ?? 0
        const marks = picked ? under?.(row) : undefined
        return (
          <div key={key} className="su-wiz-pick__line" data-band={index % 2 === 1 || undefined}>
            <label
              title={blocked}
              className={cn(
                'su-wiz-pick__row',
                picked && 'su-wiz-pick__row--selected',
                count && isSelected && 'su-wiz-pick__row--focused',
                blocked && !picked && 'su-wiz-pick__row--blocked'
              )}
            >
              <span className="su-wiz-pick__cell su-wiz-pick__cell--name">
                <input
                  type="radio"
                  name={group}
                  className="su-sr-only"
                  checked={isSelected}
                  onChange={() => onSelect(key)}
                />
                <span className="su-wiz-pick__name">{name}</span>
                {stamp?.(row)}
              </span>
              {columns.map((column) => {
                const value = column.value(row)
                return (
                  <span
                    key={column.key}
                    className={cellClass(column)}
                    data-empty={isEmpty(value) || undefined}
                    title={column.kind === 'quiet' && typeof value === 'string' ? value : undefined}
                  >
                    {column.title && <span className="su-sr-only">{column.title} </span>}
                    {isEmpty(value) ? '—' : value}
                  </span>
                )
              })}
              {count && (
                <span className="su-wiz-pick__cell su-wiz-pick__cell--count">
                  <button
                    type="button"
                    className="su-wiz-pick__step"
                    aria-label={`Remove ${name}`}
                    disabled={copies === 0}
                    onClick={() => count.onChange(row, copies - 1)}
                  >
                    −
                  </button>
                  <span className="su-wiz-pick__copies" data-empty={copies === 0 || undefined}>
                    <span className="su-sr-only">{count.label} </span>
                    {copies}
                  </span>
                  <button
                    type="button"
                    className="su-wiz-pick__step"
                    aria-label={`Add ${name}`}
                    title={copies >= most ? blocked : undefined}
                    disabled={copies >= most}
                    onClick={() => count.onChange(row, copies + 1)}
                  >
                    +
                  </button>
                </span>
              )}
              {marks && <span className="su-wiz-pick__under">{marks}</span>}
            </label>
            {detail && isSelected && (
              <div
                className={cn(
                  'su-wiz-pick__inline',
                  detailAt === 'always' && 'su-wiz-pick__inline--always'
                )}
              >
                {detail(row)}
              </div>
            )}
          </div>
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
