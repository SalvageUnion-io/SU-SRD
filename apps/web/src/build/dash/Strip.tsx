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
import type { CSSProperties, KeyboardEvent, MouseEvent, ReactNode } from 'react'
import type { CSSVarStyle, PhoneVital } from '../../components/index'
import { cn, FOCUS_RING, tokens } from '../../components/index'

/** The strip's art frame (`EntityPhoto`'s `frame`): a square thumbnail. */
// biome-ignore lint/style/useComponentExportOnlyModules: the strip's own frame, beside it
export const STRIP_ART = { aspectRatio: '1 / 1' } satisfies CSSProperties

/** Past twelve a meter is two rows, as the phone's block draws it. */
const columnsFor = (count: number) => (count > 12 ? Math.ceil(count / 2) : count)

type SegmentState = 'off' | 'redline' | 'on' | 'danger'

function segmentState(index: number, value: number, max: number, danger?: number): SegmentState {
  const from = danger ?? Number.POSITIVE_INFINITY
  if (index >= value) return index >= from && index < max ? 'redline' : 'off'
  return index >= max || index >= from ? 'danger' : 'on'
}

function Meter({
  value,
  max,
  danger,
  ink,
  cargo,
}: {
  value: number
  max: number
  danger?: number | undefined
  ink?: boolean
  cargo?: boolean
}) {
  const count = Math.max(max, value)
  return (
    <span
      className="su-strip__meter"
      aria-hidden="true"
      data-rows={count > 12 ? 2 : 1}
      data-ink={ink ? '' : undefined}
      data-cargo={cargo ? '' : undefined}
      style={{ gridTemplateColumns: `repeat(${columnsFor(count)}, minmax(0, 1fr))` }}
    >
      {Array.from({ length: count }, (_, index) => (
        <span
          // biome-ignore lint/suspicious/noArrayIndexKey: a meter's segments are its positions
          key={index}
          className="su-strip__seg"
          data-state={segmentState(index, value, max, danger)}
        />
      ))}
    </span>
  )
}

/** A live number: label, numeral, − | +, and its meter. */
function StripVital({ vital }: { vital: PhoneVital }) {
  const { label, name, value, max, note, danger, onChange } = vital
  const ceiling = max ?? Number.POSITIVE_INFINITY
  const clamp = (next: number) => Math.min(Math.max(next, 0), ceiling)
  const shown = onChange ? clamp(value) : Math.max(0, value)
  const over = max !== undefined && shown > max
  const count = max === undefined ? 0 : Math.max(max, shown)
  const summary = max === undefined ? `${name} ${shown}` : `${name} ${shown} of ${max}`

  const onKeyDown = (event: KeyboardEvent) => {
    if (!onChange || max === undefined) return
    const to: Record<string, number> = {
      ArrowRight: shown + 1,
      ArrowUp: shown + 1,
      ArrowLeft: shown - 1,
      ArrowDown: shown - 1,
      Home: 0,
      End: max,
    }
    const next = to[event.key]
    if (next === undefined) return
    event.preventDefault()
    onChange(clamp(next))
  }
  // A tap on a segment sets the value (`pipClickValue`'s rule): a lit one
  // clears from there, an unlit one fills up to it.
  const onMeterClick = (event: MouseEvent<HTMLElement>) => {
    if (!onChange || !(event.target instanceof Element)) return
    const raw = event.target.closest('[data-pip-index]')?.getAttribute('data-pip-index')
    if (raw == null) return
    const index = Number(raw)
    onChange(clamp(index < shown ? index : index + 1))
  }
  const segments = Array.from({ length: count }, (_, index) => (
    <span
      // biome-ignore lint/suspicious/noArrayIndexKey: a meter's segments are its positions
      key={index}
      className="su-strip__seg"
      data-pip-index={index}
      data-state={segmentState(index, shown, max ?? 0, danger)}
    />
  ))
  const meterStyle = { gridTemplateColumns: `repeat(${columnsFor(count)}, minmax(0, 1fr))` }
  return (
    <div
      className="su-strip__cell"
      data-vital={vital.key}
      data-counter={max === undefined ? '' : undefined}
    >
      <p className="su-strip__label">
        {label}
        <small>{max === undefined ? note : name}</small>
      </p>
      <div className="su-strip__read">
        <p className="su-strip__num" data-over={over ? '' : undefined}>
          <b>{shown}</b>
          {max !== undefined && <i>/{max}</i>}
        </p>
        {onChange && (
          <span className="su-strip__stepper">
            <button
              type="button"
              aria-label={`Decrease ${name}`}
              disabled={shown <= 0}
              className={FOCUS_RING}
              onClick={() => onChange(clamp(shown - 1))}
            >
              <Minus aria-hidden="true" size={tokens.iconSize.compact} />
            </button>
            <button
              type="button"
              aria-label={`Increase ${name}`}
              disabled={shown >= ceiling}
              className={FOCUS_RING}
              onClick={() => onChange(clamp(shown + 1))}
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
          onKeyDown={onKeyDown}
          onClick={onMeterClick}
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
  /** The reading is over its cap. */
  over?: boolean
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
}: StripFigureProps) {
  const numeric = typeof value === 'number' ? value : Number(value)
  const tl = typeof tint === 'object' ? tint.tl : undefined
  const bar = tl !== undefined ? `var(--color-tl-${String(tl).toLowerCase()})` : undefined
  return (
    <div className="su-strip__cell su-strip__cell--figure" title={name}>
      <dt className="su-strip__label">{label}</dt>
      <dd className="su-strip__value">
        <span className="su-strip__num" data-over={over ? '' : undefined}>
          <b>{value}</b>
          {max !== undefined && <i>/{max}</i>}
          {unit && <small>{unit}</small>}
        </span>
        {meter === 'pips' && max !== undefined && max <= 24 ? (
          <Meter value={numeric} max={max} ink={tint === 'ink'} cargo={tint === 'cargo'} />
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
}) {
  return (
    <div className="su-dash-top" data-print-keep="">
      {/* biome-ignore lint/a11y/useSemanticElements: a labelled group, not a landmark */}
      <div role="group" aria-label={label} className="su-mast">
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
