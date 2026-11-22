/**
 * Strip — A Live Sheet's header strip.
 *
 * One paper row under the band: the unit's art, its live vitals, then its
 * fixed figures. Every cell reads the same way — a small caps label, a big
 * tabular numeral, a slim meter — so SP, a slot budget and a Tech Level are
 * one instrument at three weights:
 *
 *   `StripVital`  a live number (SP, EP, Heat, HP, AP): the numeral, a joined
 *                 − | + beside it where the viewer may write, and a segmented
 *                 meter in the kind's tone that is the one slider tab stop.
 *                 A vital with no `max` is a counter (Training Points).
 *   `StripFigure` a fixed figure (slots, cargo, TL, SV, upkeep): the numeral
 *                 over a small meter, a colour bar, or nothing.
 *
 * The vitals take the same `PhoneVital` rows the phone's block takes, so a
 * sheet words and writes its numbers once (`sheetVitals.model.ts`). Built for
 * real this is `VitalGauge`'s strip rung (ruleset §2.1) and `Stat`'s figure.
 */

import { Minus, Plus } from 'lucide-react'
import type { CSSProperties, ReactNode } from 'react'
import { useContext } from 'react'
import * as tokens from '../../design/tokens'
import { cn } from '../../lib/cn'
import { atomsCopy } from '../../messages/components-atoms'
import type { CSSVarStyle } from '../../styles/cssVars'
import { capsLabel } from './capsLabel'
import { FOCUS_RING } from './interaction'
import { trackSegmentState } from './pipRows'
import { RuleBreakMark } from './RuleBreakMark'
import { StatMeaningContext } from './statMeaning'
import { VitalMax } from './VitalMax'
import type { PhoneVital } from './vitalControl'
import { meterColumns, useVitalControl } from './vitalControl'

/** A caps label: the condensed face in capitals (ruleset §3.12). */
const CAPS = capsLabel({ weight: 'inherit', tracking: 'inherit' })

/** The strip's art frame (`EntityPhoto`'s `frame`): a square thumbnail. */
// biome-ignore lint/style/useComponentExportOnlyModules: the strip's own frame, beside it
export const STRIP_ART = { aspectRatio: '1 / 1' } satisfies CSSProperties

function Meter({
  value,
  max,
  danger,
  ink,
  cargo,
  perRow,
}: {
  value: number
  max: number
  danger?: number | undefined
  ink?: boolean
  cargo?: boolean
  perRow?: number | undefined
}) {
  const count = Math.max(max, value)
  const columns = perRow ? Math.min(perRow, count) : meterColumns(count)
  const tracks = { gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` } // design-tokens-ignore(item-grid): a meter's segments, a fixed track
  return (
    <span
      className="su-strip__meter"
      aria-hidden="true"
      data-rows={count > 12 ? 2 : 1}
      data-ink={ink ? '' : undefined}
      data-cargo={cargo ? '' : undefined}
      style={tracks}
    >
      {Array.from({ length: count }, (_, index) => (
        <span
          // biome-ignore lint/suspicious/noArrayIndexKey: a meter's segments are its positions
          key={index}
          className="su-strip__seg"
          data-state={trackSegmentState(index, value, max, danger)}
        />
      ))}
    </span>
  )
}

/**
 * A live number: label, numeral, − | +, and its meter, stepping through the
 * one control `PhoneVitals` shares (`useVitalControl`). In Edit its max is
 * `VitalMax`, a field a press away.
 */
function StripVital({ vital }: { vital: PhoneVital }) {
  const { label, name, max, note, onChange, maxEdit } = vital
  const meaning = useContext(StatMeaningContext)
  const words = (
    <>
      {label}
      <small>{max === undefined ? note : name}</small>
    </>
  )
  const control = useVitalControl(vital)
  const { shown, count, summary } = control
  const segments = Array.from({ length: count }, (_, index) => (
    <span
      // biome-ignore lint/suspicious/noArrayIndexKey: a meter's segments are its positions
      key={index}
      className="su-strip__seg"
      data-pip-index={index}
      data-state={control.segment(index)}
    />
  ))
  const meterStyle = {
    gridTemplateColumns: `repeat(${meterColumns(count)}, minmax(0, 1fr))`, // design-tokens-ignore(item-grid): a meter's segments, a fixed track
  }
  return (
    <div
      className="su-strip__cell"
      data-vital={vital.key}
      data-counter={max === undefined ? '' : undefined}
    >
      {/* The label opens what the number means, where the sheet says how (r4 E21). */}
      <p className={cn('su-strip__label', CAPS)}>{meaning ? meaning(vital.key, words) : words}</p>
      <div className="su-strip__read">
        <p className={cn('su-strip__num', CAPS)} data-over={control.over ? '' : undefined}>
          <b>{shown}</b>
          {max !== undefined &&
            (maxEdit ? (
              <i>
                /<VitalMax label={label} max={max} edit={maxEdit} />
              </i>
            ) : (
              <i>/{max}</i>
            ))}
        </p>
        {onChange && (
          <span className="su-strip__stepper">
            <button
              type="button"
              aria-label={atomsCopy('decrease2', { label: name })}
              disabled={control.atFloor}
              className={FOCUS_RING}
              {...control.press(-1)}
            >
              <Minus aria-hidden="true" size={tokens.iconSize.compact} />
            </button>
            <button
              type="button"
              aria-label={atomsCopy('increase2', { label: name })}
              disabled={control.atCeiling}
              className={FOCUS_RING}
              {...control.press(1)}
            >
              <Plus aria-hidden="true" size={tokens.iconSize.compact} />
            </button>
          </span>
        )}
      </div>
      {max === undefined ? (
        // A counter has no meter: its place is kept, so its numeral sits on
        // the line its neighbours' do.
        <div className="su-strip__meter" aria-hidden="true" style={{ visibility: 'hidden' }}>
          <span className="su-strip__seg" />
        </div>
      ) : onChange ? (
        <div
          role="slider"
          tabIndex={0}
          aria-label={name}
          aria-valuemin={0}
          aria-valuemax={max}
          aria-valuenow={shown}
          aria-valuetext={summary}
          className={cn('su-strip__meter', FOCUS_RING)}
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
          className="su-strip__meter"
          data-rows={count > 12 ? 2 : 1}
          style={meterStyle}
        >
          {segments}
        </div>
      )}
    </div>
  )
}

export type StripFigureProps = {
  /** The short label: `SYS`, `Cargo`, `TL`. */
  label: string
  /** Its words in full, for the hover and assistive tech. */
  name: string
  value: number | string
  max?: number
  /** A quiet word after the numeral: `T1+ Scrap`. */
  unit?: string
  /** `pips`: one segment a unit (to 24). `bar`: one bar, `fill` of it lit. */
  meter?: 'pips' | 'bar'
  /** The bar's colour on the colour map (a Tech Level's), or the pips' kind. */
  tint?: 'ink' | 'cargo' | { tl: number | string }
  /** The reading is over its cap: it wears the one rule-breaking mark (R71). */
  over?: boolean
  /** Pips to a row: a pilot's six inventory slots sit 3 × 2. */
  perRow?: number
  /** The stat's key, where its label opens what it means (`inventory`, r4 E21). */
  statKey?: string
}

/** A fixed figure: label, numeral, and a small meter where there is one. */
export function StripFigure({
  label,
  name,
  value,
  max,
  unit,
  meter,
  tint,
  over,
  perRow,
  statKey,
}: StripFigureProps) {
  const meaning = useContext(StatMeaningContext)
  const numeric = typeof value === 'number' ? value : Number(value)
  const tl = typeof tint === 'object' ? tint.tl : undefined
  const bar = tl !== undefined ? `var(--color-tl-${String(tl).toLowerCase()})` : undefined
  return (
    <div className="su-strip__cell su-strip__cell--figure" title={name}>
      <dt className={cn('su-strip__label', CAPS)}>
        {meaning && statKey ? meaning(statKey, label) : label}
      </dt>
      <dd className="su-strip__value">
        <span className={cn('su-strip__num', CAPS)} data-over={over ? '' : undefined}>
          <b>{value}</b>
          {max !== undefined && <i>/{max}</i>}
          {unit && <small>{unit}</small>}
        </span>
        {over && <RuleBreakMark />}
        {meter === 'pips' && max !== undefined && max <= 24 ? (
          <Meter
            value={numeric}
            max={max}
            ink={tint === 'ink'}
            cargo={tint === 'cargo'}
            perRow={perRow}
          />
        ) : meter === 'bar' ? (
          <span
            className="su-strip__bar"
            aria-hidden="true"
            style={bar ? ({ '--bar': bar } as CSSVarStyle) : undefined}
          >
            <span
              style={{
                width: `${max !== undefined && max > 0 ? Math.min(100, (numeric / max) * 100) : 100}%`,
              }}
            />
          </span>
        ) : (
          <span className="su-strip__bar" aria-hidden="true" style={{ visibility: 'hidden' }} />
        )}
      </dd>
    </div>
  )
}

/**
 * The masthead (best variant): the unit's face, its live numbers and who it
 * is, in one paper block under the band.
 *
 *   art      the portrait or chassis drawing at a size that reads as a face
 *            (the current sheet's hero; the bold mock's poster art).
 *   board    the live vitals, numerals at the chapter rung over chunky
 *            segments (COMP/CON's stat cells; the current sheet's pips), then
 *            one quiet rail: the fixed figures.
 *   identity what the printed sheet opens with: a pilot's Motto, Keepsake
 *            and Background; a mech's Quirk and Appearance.
 */
export function Strip({
  label,
  art,
  vitals,
  figures,
  foot,
  identity,
  traits,
  edit = false,
}: {
  /** Names the strip: "Mazona vitals". */
  label: string
  art?: ReactNode
  vitals: readonly PhoneVital[]
  figures?: ReactNode
  foot?: ReactNode
  /** The printed sheet's identity block, beside the board. */
  identity?: ReactNode
  /** The unit's short lines (Motto, Keepsake, Background; Quirk, Appearance), inline on the figures' rail. */
  traits?: ReactNode
  /** Edit: the identity is its fields, laid under the board at its width. */
  edit?: boolean
}) {
  return (
    <div className="su-dash-top" data-print-keep="">
      {/* biome-ignore lint/a11y/useSemanticElements: a labelled group, not a landmark */}
      <div role="group" aria-label={label} className="su-mast" data-edit={edit ? '' : undefined}>
        {art && <div className="su-mast__art">{art}</div>}
        <div className="su-mast__board">
          {vitals.length > 0 && (
            <div className="su-strip__vitals">
              {vitals.map((vital) => (
                <StripVital key={vital.key} vital={vital} />
              ))}
            </div>
          )}
          {(figures || traits) && (
            <div className="su-mast__rail">
              {figures && <dl className="su-strip__figures">{figures}</dl>}
              {traits && <div className="su-mast__traits">{traits}</div>}
            </div>
          )}
          {foot && <div className="su-strip__foot">{foot}</div>}
        </div>
        {identity && <div className="su-mast__identity">{identity}</div>}
      </div>
    </div>
  )
}
