/**
 * PhoneVitals, a phone's vitals block for every
 * Live Sheet and for Play: one quiet card, one 52px row a number. A row is
 * the short label (SP), a slim segmented meter in the kind's colour
 * (`--tone`, the band colour of the colour map; Heat's redline in `--color-status-bad`), the
 * value over its max in plain tabular numerals, and a joined − | + pair, each
 * half a 44px target. A press steps by one; a hold repeats. The meter is the
 * one `role="slider"` tab stop a row has (arrow keys, Home, End), and a tap on
 * a segment sets the value. With `onValuePress` the value is a button too:
 * the caller asks for an amount (Play's "take 3").
 *
 * A row with no `max` is a counter (Training Points, Upkeep): no meter, its
 * note in the meter's place. `foot` is the block's last row: conditions, a
 * crawler's Pay / Fund / Trade.
 *
 * It strays from the site's dress on purpose (the owner's phone-vitals
 * ruling): no ink stamp, no framed numeral, no ink-block steppers. Tokens and
 * the colour map only. Desktop keeps `VitalGauge`.
 *
 * `PhoneVitalsGlance` is the same idiom at a glance row's size: one card of
 * cells, each a label, the value over its max and a slim meter, each a
 * button that opens that number's rows.
 *
 * Geometry and states are `.su-phone-vitals*` and `.su-phone-glance*`
 * (`styles/partials/phone-vitals.css`): every property here has a pressed,
 * disabled or per-row variant.
 */

import { Minus, Plus } from 'lucide-react'
import type { CSSProperties, ReactNode } from 'react'
import { useContext } from 'react'
import { iconSize } from '../../design/tokens'
import { cn } from '../../lib/cn'
import { atomsCopy } from '../../messages/components-atoms'
import { capsLabel } from './capsLabel'
import { FOCUS_RING } from './interaction'
import { StatMeaningContext } from './statMeaning'
import type { PhoneVital } from './vitalControl'
import { meterColumns, useVitalControl } from './vitalControl'

export type { PhoneVital } from './vitalControl'

type PhoneVitalsProps = {
  /** Names the block: "Mazona vitals". */
  label: string
  vitals: readonly PhoneVital[]
  /** The block's last row: conditions, action chips. */
  foot?: ReactNode
  className?: string
  /** Pins `--tone` / `--tone-deep` where the surface sets none (Play). */
  style?: CSSProperties
}

const LABEL_CAPS = cn('su-phone-vitals__label', capsLabel({ size: 'lede', tracking: 'snug' }))
const GLANCE_CAPS = cn('su-phone-glance__label', capsLabel({ size: 'caption', tracking: 'snug' }))

export function PhoneVitals({ label, vitals, foot, className, style }: PhoneVitalsProps) {
  const steps = vitals.some((vital) => vital.onChange)
  return (
    // biome-ignore lint/a11y/useSemanticElements: a labelled group, not a landmark
    <div
      role="group"
      aria-label={label}
      className={cn('su-phone-vitals', className)}
      data-steps={steps ? '' : undefined}
      style={style}
    >
      {vitals.map((vital) => (
        <Row key={vital.key} vital={vital} />
      ))}
      {foot && <div className="su-phone-vitals__foot">{foot}</div>}
    </div>
  )
}

function Row({ vital }: { vital: PhoneVital }) {
  const { label, name, max, note, onChange } = vital
  const control = useVitalControl(vital)
  const meaning = useContext(StatMeaningContext)
  const { shown, count, summary } = control
  const segments = Array.from({ length: count }, (_, index) => (
    <span
      // biome-ignore lint/suspicious/noArrayIndexKey: a meter's segments are its positions
      key={index}
      className="su-phone-vitals__seg"
      data-pip-index={index}
      data-state={control.segment(index)}
    />
  ))
  const meterStyle = { gridTemplateColumns: `repeat(${meterColumns(count)}, minmax(0, 1fr))` }

  return (
    <div className="su-phone-vitals__row" data-vital={vital.key}>
      <span className={LABEL_CAPS} title={name}>
        {meaning ? meaning(vital.key, label) : label}
      </span>
      {max === undefined ? (
        <span className="su-phone-vitals__note">{note}</span>
      ) : onChange ? (
        <div
          role="slider"
          tabIndex={0}
          aria-label={name}
          aria-valuemin={0}
          aria-valuemax={max}
          aria-valuenow={shown}
          aria-valuetext={summary}
          className={cn('su-phone-vitals__meter', FOCUS_RING)}
          data-rows={count > 12 ? 2 : 1}
          data-live=""
          style={meterStyle}
          onKeyDown={control.onKeyDown}
          onClick={control.onMeterClick}
        >
          {segments}
        </div>
      ) : (
        <div
          role="img"
          aria-label={summary}
          className="su-phone-vitals__meter"
          data-rows={count > 12 ? 2 : 1}
          style={meterStyle}
        >
          {segments}
        </div>
      )}
      {onChange && vital.onValuePress && max !== undefined ? (
        <button
          type="button"
          className={cn('su-phone-vitals__value', FOCUS_RING)}
          data-over={control.over ? '' : undefined}
          aria-label={atomsCopy('changeByAmount', { label: name, value: shown, max })}
          onClick={vital.onValuePress}
        >
          <b>{shown}</b>
          <i>/{max}</i>
        </button>
      ) : (
        <span className="su-phone-vitals__value" data-over={control.over ? '' : undefined}>
          <b>{shown}</b>
          {max !== undefined && <i>/{max}</i>}
        </span>
      )}
      {onChange && (
        <span className="su-phone-vitals__stepper">
          <button
            type="button"
            aria-label={atomsCopy('decrease2', { label: name })}
            disabled={control.atFloor}
            className={FOCUS_RING}
            {...control.press(-1)}
          >
            <Minus aria-hidden="true" size={iconSize.full} />
          </button>
          <button
            type="button"
            aria-label={atomsCopy('increase2', { label: name })}
            disabled={control.atCeiling}
            className={FOCUS_RING}
            {...control.press(1)}
          >
            <Plus aria-hidden="true" size={iconSize.full} />
          </button>
        </span>
      )}
    </div>
  )
}

export type PhoneVitalCell = {
  key: string
  /** The short label: `SP`, `Heat`. */
  label: string
  /** The words in full, for assistive tech: `Mazona Structure Points`. */
  name: string
  value: number
  max: number
  /** Pins the cell's `--tone`, its unit's colour. */
  style?: CSSProperties
  /** Past its redline: the value and the meter read danger. */
  hot?: boolean
  /** This cell's rows are open under the card. */
  open?: boolean
  /** With it the cell is a button; without, a read-out. */
  onPress?: () => void
}

/** One card of cells on one row, each a button that opens its number's rows. */
export function PhoneVitalsGlance({ cells }: { cells: readonly PhoneVitalCell[] }) {
  return (
    <ul className="su-phone-glance">
      {cells.map((cell) => (
        <li key={cell.key}>
          <button
            type="button"
            className={cn('su-phone-glance__cell', FOCUS_RING)}
            style={cell.style}
            aria-expanded={cell.open ?? false}
            aria-label={atomsCopy('changeValueOfMax', {
              name: cell.name,
              value: cell.value,
              max: cell.max,
            })}
            disabled={!cell.onPress}
            data-hot={cell.hot ? '' : undefined}
            onClick={cell.onPress}
          >
            <span className={GLANCE_CAPS}>{cell.label}</span>
            <span className="su-phone-glance__value">
              <b>{cell.value}</b>
              <i>/{cell.max}</i>
            </span>
            <span className="su-phone-glance__meter" aria-hidden="true">
              <span
                style={{
                  width: `${cell.max > 0 ? Math.min(100, (cell.value / cell.max) * 100) : 0}%`,
                }}
              />
            </span>
          </button>
        </li>
      ))}
    </ul>
  )
}
