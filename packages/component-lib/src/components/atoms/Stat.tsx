import type { CSSProperties, ReactElement } from 'react'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { EntityRef } from 'salvageunion-reference'
import { borderWidth, color, font, fontSize, radius, space, weight } from '../../design/tokens'
import { usePeekAttrs } from '../../entity/peekContext'
import type { SizeRung } from '../../styles/sizing'
import type { StampSurface } from './Badge'
import { Badge } from './Badge'
import type { EntityStatus } from './entityStatus'
import { FOCUS_RING } from './interaction'
import { Tooltip } from './Tooltip'

/**
 * The canonical stat/value primitive (canonical primitive language §2). One
 * prop-controlled component with TWO anatomies — it absorbs the former
 * ValueDisplay (horizontal label|value) and StatControl (box + steppers):
 *
 *   orientation="horizontal"  -> the horizontal [label | value] cell, in either
 *                                material: `surface="plate"` (default, the
 *                                stamp pair) or `surface="plain"` (running
 *                                text).
 *   (default)                 -> the centred value box with Badge stamps
 *                                above/below; mode="edit" adds +/- steppers.
 *
 * Both anatomies render ONE canonical ink-on-paper cell — no per-stat fill or
 * value colour. State is carried entirely by the BORDER colour via the `state`
 * prop (see StatBorderState); the fill/text/stamp stay constant. A value with a
 * `max` reads as `current /max` (current prominent, /max muted); a bare value
 * centres. Stat has NO pip mode: pip trackers were retired (use the value box; a
 * fill bar is `VitalGauge`).
 */

/** Stat tone (a public alias retained for consumers that key colour by stat). */
export type StatTone = 'hp' | 'ap' | 'ep' | 'sp' | 'heat' | 'cargo' | 'cw' | 'default'
/** A tri-state condition value (e.g. a crawler bay's condition). */
export type StatState = EntityStatus

/**
 * The ONE lever that changes between stat states — it drives only the cell's
 * BORDER colour; fill, text, label and stamp are constant (canonical primitive
 * language: "hue encodes ontology; state is a treatment overlay"). Which value
 * maps to which state is the consumer's call ("at cap" is `good` for SP but
 * `critical` for Heat).
 *
 *   default  -> ink border (the resting state)
 *   good     -> mech   (full / at-cap-good)
 *   modified -> heavier solid ink frame, border plus a 1px ring (value changed from its base, e.g. a modified TL)
 *   caution  -> status-warn
 *   critical -> status-bad
 */
export type StatBorderState = 'default' | 'good' | 'modified' | 'caution' | 'critical'

const STATE_BORDER: Record<StatBorderState, string> = {
  default: color.ink,
  good: color.mech,
  modified: color.ink,
  caution: color.statusWarn,
  critical: color.statusBad,
}

/** `modified`'s extra 1px ink ring rides a class, not the style object: on the
 * clickable box an inline `box-shadow` would mask the shared focus ring. */
const STATE_RING_CLASS = 'su-stat--modified'

/** Joins the truthy class names (the plain-concatenation half of `cn`). */
function classes(...names: (string | false | null | undefined)[]): string | undefined {
  const joined = names.filter(Boolean).join(' ')
  return joined === '' ? undefined : joined
}

/** The colour transition: the colour properties over 150ms, standard easing. */
const TRANSITION_COLORS = {
  transitionDuration: '150ms',
  transitionProperty:
    'color, background-color, border-color, outline-color, text-decoration-color, fill, stroke, --tw-gradient-from, --tw-gradient-via, --tw-gradient-to',
  transitionTimingFunction: 'cubic-bezier(0.4, 0, 0.2, 1)',
} satisfies CSSProperties

/** The inherited `text-xs` / `text-sm` rungs carry their paired line-height. */
const LINE_HEIGHT_XS = 'calc(1 / 0.75)'
const LINE_HEIGHT_SM = 'calc(1.25 / 0.875)'

type StatValue = number | string

/**
 * Stat is a discriminated union over its two mutually-exclusive
 * anatomies, keyed on `orientation`:
 *
 *   { orientation: 'horizontal' } -> HorizontalValue (label|value)
 *   (default)                     -> ValueBox (centred box)
 *
 * Every prop is scoped to the anatomy that reads it. `Exact<>` (below) then
 * forbids every OTHER anatomy's props with `?: never`, so mixing anatomies is a
 * compile error, not a silently-ignored prop.
 */

/** Every prop name any anatomy accepts — the domain `Exact<>` closes over. */
type StatPropKey =
  | 'label'
  | 'value'
  | 'max'
  | 'min'
  | 'bottomLabel'
  | 'orientation'
  | 'surface'
  | 'mode'
  | 'step'
  | 'stepperLabel'
  | 'inverse'
  | 'size'
  | 'onChange'
  | 'onClick'
  | 'hoverText'
  | 'peek'
  | 'flash'
  | 'disabled'
  | 'state'
  | 'bgColor'
  | 'textColor'
  | 'inline'
  | 'labelId'
  | 'ariaLabel'
  | 'className'
  | 'truncate'
  | 'wrap'

/** `T`, plus every stat prop NOT in `T` forbidden (`?: never`) — the exclusion
 * that makes the anatomies genuinely non-overlapping at the type level. */
type Exact<T extends Partial<Record<StatPropKey, unknown>>> = T &
  Partial<Record<Exclude<StatPropKey, keyof T>, never>>

/** [horizontal] `orientation="horizontal"`. With
 * `onChange` + `mode="edit"` it grows a compact +/- stepper column. */
type HorizontalValueProps = Exact<{
  /** Header code / label ('HP', 'Range', or a numeric tier). */
  label: StatValue
  orientation: 'horizontal'
  value?: StatValue
  /**
   * The cell's MATERIAL — same geometry (`label` then `value`, inline), two
   * finishes (canonical primitive language §0: geometry is constant across
   * contexts; only materials, density and interactivity change).
   *
   *   `plate` (default) — the stamp pair on a bordered, rounded cell.
   *   `plain`           — RUNNING TEXT: `SP 9/13`, no plate, no border, no
   *                       radius. The label inherits the surrounding line's
   *                       colour and the reading is a `<b>` so a text container
   *                       can weight it (the sheet rail body does exactly this).
   *
   * `plain` exists because the linked-units rail is specified as running text
   * rather than plates, and that gap had grown its OWN primitive (`StatLine`)
   * arguing running text and plates were "different jobs". They are not: they
   * are one `label | value` cell in two materials, so the fix was this rung —
   * ruleset §3.7, every `label | value` renders through `Stat`.
   *
   * `plain` is a text finish: `state`, `bgColor`/`textColor` and `inverse` all
   * style the plate and are inert on it.
   */
  surface?: 'plate' | 'plain'
  /** Optional max — renders the value as `value /max` (muted /max suffix on
   * `plate`; part of the bold reading on `plain`, which is unbroken text). */
  max?: number
  /** Optional second label line — renders the label cell as a two-line stack
   * (`label` on top, `bottomLabel` below), e.g. "Tech" / "Level". */
  bottomLabel?: StatValue
  /**
   * Ladder rung (styles/sizing.ts). This anatomy's resting state is a reading
   * cell, so it defaults to `full`; `compact` is the listing-row scale and
   * `mini` the seam-tag size (text-badge / 11px). One axis: a pair of booleans
   * could be combined into a rung that doesn't exist; a single `size` cannot.
   */
  size?: SizeRung
  inverse?: boolean
  /** inline-flex (default) vs flex. */
  inline?: boolean
  /** State overlay — drives the border colour only (see StatBorderState). */
  state?: StatBorderState
  /** Label-plate tint (raw CSS colours) — the CHIP role only (subheader
   * trait/datavalue cells, group labels). Tints the label cell, not a stat's
   * value. Stat readouts stay ink-canonical and use `state` instead. */
  bgColor?: string
  textColor?: string
  /** Edit layer: with `mode="edit"`, render a +/- stepper column to the cell's
   * right. `min` bounds the stepper (max is the readout cap when set). */
  onChange?: (value: number) => void
  mode?: 'read' | 'edit'
  min?: number
  /**
   * Increment per press (default 1). The crawler Trading Bay trades scrap in
   * fixed exchange lots, so its quantity stepper moves by the lot size rather
   * than by one — it had grown a hand-assembled `StepButton` pair for exactly
   * that reason. A stepper that counts by N is the same control at a different
   * granularity, so the fix is this rung, not a bespoke cluster.
   */
  step?: number
  /**
   * Accessible-name stem for the +/- buttons — they read
   * `Decrease {stepperLabel}` / `Increase {stepperLabel}`. Defaults to `label`.
   *
   * The plate's visible `label` is a terse code ('SCRAP', 'QTY') sized for the
   * cell, while a stepper's accessible name wants the full noun phrase
   * ('contribution', 'trade amount by 5'). Hand-assembled steppers took their
   * name from the caller; this keeps that contract when they fold onto Stat.
   */
  stepperLabel?: string
  /** The glossary entry the cell's label names (a measured keyword, "Damage |
   * 2 SP"): the cell Peeks it on hover (entity display language E4). */
  peek?: EntityRef
  /** Plain-text hover explanation (the stat's glossary line). Same contract as
   * the value box's `hoverText` — a compact header cell states the SAME stat as
   * the full box, so it must be able to explain itself too. */
  hoverText?: string
  /**
   * A cell in a row that may be too narrow for it (a seam marker on a phone):
   * the cell may shrink, and its value truncates with "…" rather than being
   * cut mid-word by the row's clip. The label never shrinks.
   */
  truncate?: boolean
  /**
   * A cell in a wrapping row whose value may be longer than the row is wide
   * (a hybrid class's `REQ | Augmentation or Gladiatorial` in a catalog
   * tile): alone on its line, the cell narrows to the row and its value wraps
   * onto more lines, rather than being clipped by the frame. A cell that fits
   * is unchanged. The label never wraps.
   */
  wrap?: boolean
  className?: string
}>

/** [box] the default centred value box; `mode="edit"` adds steppers (former StatControl). */
type ValueBoxProps = Exact<{
  label: StatValue
  /**
   * Accessible-name stem for the +/- buttons, exactly as on the horizontal
   * anatomy — `Decrease {stepperLabel}` / `Increase {stepperLabel}`, defaulting
   * to `label`. It was declared on the horizontal anatomy only, so `Exact<>`
   * forbade it here even though both rungs render steppers; a box whose visible
   * `label` is one half of a two-line readout ('TRAINING' over 'POINTS') had no
   * way to name its steppers with the whole phrase.
   */
  stepperLabel?: string
  orientation?: 'vertical'
  value?: StatValue
  max?: number
  /** Minimum for edit-mode steppers. */
  min?: number
  /** Bottom stamp. */
  bottomLabel?: string
  labelId?: string
  disabled?: boolean
  onClick?: () => void
  onChange?: (value: number) => void
  mode?: 'read' | 'edit'
  /** State overlay — drives the border colour only (see StatBorderState). */
  state?: StatBorderState
  ariaLabel?: string
  /**
   * Ladder rung (styles/sizing.ts). The box's resting state is a scan-past
   * cell, so it defaults to `compact`; `mini` is the dense 32px box (the
   * former `compact` boolean).
   *
   * `full` is the readout-as-destination rung — a 64px box with a
   * `text-display` (26px) numeral, for figures meant to carry a panel at a
   * glance (the crawler economy's Scrap / Tech Level / Crew), so a headline
   * number never hand-assembles its own numeral and `/max` slash.
   *
   * One axis: two booleans could contradict each other; a single `size`
   * cannot.
   */
  size?: SizeRung
  flash?: boolean
  inverse?: boolean
  hoverText?: string
  className?: string
}>

type StatProps = HorizontalValueProps | ValueBoxProps

export function Stat(props: StatProps) {
  const inner = renderStat(props)
  const peek = usePeekAttrs('peek' in props ? props.peek : undefined)
  if (!peek['data-peek']) return inner
  // The cell carries the Peek's address; the page's PeekHost does the rest.
  return (
    <span {...peek} style={{ display: 'inline-flex', flex: 'none', lineHeight: 1 }}>
      {inner}
    </span>
  )
}

function renderStat(props: StatProps) {
  if (props.orientation === 'horizontal') return <HorizontalValue {...props} />
  return <ValueBox {...props} />
}

/* ------------------------------------------------------------------ *
 * Horizontal [label | value]. Ink/paper                               *
 * stamp pair, rounded; state rides the border.                        *
 * ------------------------------------------------------------------ */
function HorizontalValue({
  label,
  value,
  max,
  bottomLabel,
  surface = 'plate',
  size = 'full',
  inverse = false,
  inline = true,
  state = 'default',
  bgColor,
  textColor,
  onChange,
  mode = 'read',
  min = 0,
  step = 1,
  stepperLabel,
  hoverText,
  truncate = false,
  wrap = false,
  className,
}: HorizontalValueProps) {
  // Both halves of the cell take the rung's type; line-height is 1 throughout.
  const plateType = {
    fontSize: size === 'mini' ? fontSize.badge : size === 'compact' ? fontSize.xs : fontSize.sm,
    fontWeight:
      size === 'mini' ? weight.bold : size === 'compact' ? weight.normal : weight.semibold,
    lineHeight: 1,
    textTransform: 'uppercase',
  } satisfies CSSProperties
  const mainSurface: StampSurface = inverse ? 'inverse' : 'on-ink'
  const valueSurface: StampSurface = inverse ? 'on-ink' : 'inverse'

  // The hover explanation rides the OUTERMOST node of whichever anatomy we
  // return, so it works on the bare cell, the running-text finish and the
  // cell+stepper cluster alike. `Tooltip` is already inert inside a hovercard
  // (InsideTooltipContext), so nested cards need no extra suppression here.
  const withHover = (node: ReactElement) =>
    hoverText ? <Tooltip content={hoverText}>{node}</Tooltip> : node

  // PLAIN material — running text (`SP 9/13`). No plate, no border, no radius;
  // an inert inline `<span>` so it neither breaks the line's flow nor changes
  // how the surrounding sentence wraps. The reading (value AND `/max`) is one
  // unbroken `<b>`: on a text line the slash belongs to the number, so it is
  // not split off and muted the way the plate's `/max` suffix is.
  //
  // `plain` is a READ finish and returns here: a +/- stepper column belongs to
  // a cell with an edge, not to a word in a sentence, so `mode="edit"` has no
  // plain rendering (use the plate material when the stat is editable).
  if (surface === 'plain') {
    return withHover(
      <span className={className}>
        {label}
        {value !== undefined && (
          <>
            {' '}
            <b>
              {value}
              {max !== undefined && `/${max}`}
            </b>
          </>
        )}
      </span>
    )
  }

  const cell = (
    <span
      // `display` and `flex-shrink` stay in a class: callers override them by
      // className (the sheet's condensed bar folds cells with `hidden sm:inline-flex`).
      className={classes(
        'su-stat-cell',
        !inline && 'su-stat-cell--block',
        truncate && 'su-stat-cell--truncate',
        wrap && 'su-stat-cell--wrap',
        state === 'modified' && STATE_RING_CLASS,
        className
      )}
      style={{
        alignItems: 'stretch',
        borderColor: STATE_BORDER[state],
        borderRadius: radius.badge,
        borderStyle: 'solid',
        borderWidth: borderWidth.hairline,
        cursor: 'default',
        flexGrow: 0,
        overflow: 'hidden',
        whiteSpace: wrap && !truncate ? 'normal' : 'nowrap',
        width: 'fit-content',
        ...(truncate || wrap ? { minWidth: 0 } : undefined),
      }}
    >
      <Badge
        shape="stamp"
        size="mini"
        surface={mainSurface}
        // Stretch to the FULL cell height (overriding the stamp's inline-block)
        // so the label's ink background always covers the whole cell, and
        // center the text vertically — even when the row stretches it. The
        // CELL draws the single rounded border; the `inverse` plate's own
        // inset ring would double it, so both halves suppress it.
        style={{
          ...plateType,
          alignItems: 'center',
          alignSelf: 'stretch',
          boxShadow: 'none',
          display: 'flex',
          // Two-line label cell (e.g. "Tech" / "Level") when a bottomLabel is set.
          ...(bottomLabel !== undefined ? { flexDirection: 'column' } : undefined),
          justifyContent: 'center',
          // The label stays one line when the value wraps beside it.
          whiteSpace: 'nowrap',
          ...(bgColor || textColor ? { backgroundColor: bgColor, color: textColor } : undefined),
        }}
      >
        {bottomLabel !== undefined ? (
          <>
            <span>{label}</span>
            <span>{bottomLabel}</span>
          </>
        ) : (
          label
        )}
      </Badge>
      {value !== undefined && (
        <Badge
          shape="stamp"
          size="mini"
          surface={valueSurface}
          style={{
            ...plateType,
            alignSelf: 'stretch',
            boxShadow: 'none',
            // A block when truncating, so the ellipsis applies (a flex box's
            // text never gets one).
            ...(truncate
              ? {
                  display: 'block',
                  minWidth: 0,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }
              : {
                  alignItems: 'center',
                  display: 'flex',
                  gap: '1px',
                  // Wrapping, it narrows with its cell; a word longer than the
                  // row breaks rather than being clipped.
                  ...(wrap ? { minWidth: 0, overflowWrap: 'anywhere' } : undefined),
                }),
          }}
        >
          {value}
          {max !== undefined && (
            <span
              style={{ color: inverse ? color.paper70 : color.wkMuted, fontWeight: weight.normal }}
            >
              /{max}
            </span>
          )}
        </Badge>
      )}
    </span>
  )

  // COMPACT STAT WITH STEPPERS — the horizontal peer of the value box's edit
  // mode: the `[label|value]` cell with a small vertical +/- column to its
  // right. Read-only (no edit / no onChange) returns the bare cell, unchanged.
  const numericValue = typeof value === 'number' ? value : Number(value)
  const canEdit = mode === 'edit' && onChange !== undefined && Number.isFinite(numericValue)
  if (!canEdit) return withHover(cell)

  const atMin = numericValue <= min
  const atMax = max !== undefined && numericValue >= max
  // Buttons sit SIDE BY SIDE after the value cell and stretch to its height, so
  // the stepper adds no vertical height to the row. The resting fill/ink and
  // the coarse-pointer 44px floor live in classes (they flip on hover / at sm).
  const stepClass = (atLimit: boolean) =>
    classes(
      'su-stat-step',
      inverse ? 'su-stat-step--on-ink' : 'su-stat-step--on-paper',
      !atLimit && 'su-stat-step--live'
    )
  const stepStyle = (atLimit: boolean) =>
    ({
      ...TRANSITION_COLORS,
      alignItems: 'center',
      borderColor: inverse ? color.paper : color.ink,
      borderRadius: radius.badge,
      borderStyle: 'solid',
      borderWidth: borderWidth.hairline,
      cursor: atLimit ? 'not-allowed' : 'pointer',
      display: 'flex',
      fontFamily: font.body,
      fontSize: size === 'compact' ? fontSize.xs : fontSize.sm,
      fontWeight: weight.bold,
      justifyContent: 'center',
      lineHeight: size === 'compact' ? LINE_HEIGHT_XS : LINE_HEIGHT_SM,
      width: size === 'compact' ? space[16] : space[20],
      ...(atLimit ? { opacity: 0.3 } : undefined),
    }) satisfies CSSProperties

  const stepName = stepperLabel ?? label
  return withHover(
    <span
      style={{ alignItems: 'stretch', display: 'inline-flex', gap: space[2], width: 'fit-content' }}
    >
      {cell}
      <button
        type="button"
        aria-label={`Decrease ${stepName}`}
        onClick={() => onChange?.(Math.max(min, numericValue - step))}
        disabled={atMin}
        className={stepClass(atMin)}
        style={stepStyle(atMin)}
      >
        −
      </button>
      <button
        type="button"
        aria-label={`Increase ${stepName}`}
        onClick={() =>
          onChange?.(max !== undefined ? Math.min(max, numericValue + step) : numericValue + step)
        }
        disabled={!!atMax}
        className={stepClass(!!atMax)}
        style={stepStyle(!!atMax)}
      >
        +
      </button>
    </span>
  )
}

/* ------------------------------------------------------------------ *
 * Centred value box; rounded, ink-on-paper.                          *
 * A `max` reads as `current /max`; state rides the border.            *
 * mode="edit" grows the +/- stepper column.                           *
 * ------------------------------------------------------------------ */
function ValueBox({
  label,
  stepperLabel,
  value,
  max,
  min = 0,
  bottomLabel,
  labelId,
  disabled,
  onClick,
  onChange,
  mode = 'read',
  state = 'default',
  ariaLabel,
  size = 'compact',
  flash = false,
  inverse = false,
  hoverText,
  className,
}: ValueBoxProps) {
  const [isFlashing, setIsFlashing] = useState(false)

  const combinedAriaLabel = ariaLabel || (bottomLabel ? `${label} ${bottomLabel}` : String(label))
  const trueBg = inverse ? color.ink : color.paper
  const trueValueColor = inverse ? color.paper : color.ink
  const mutedMaxColor = inverse ? color.paper70 : color.wkMuted
  const trueBorderColor = STATE_BORDER[state]

  useEffect(() => {
    if (!flash) return
    const startTimer = setTimeout(() => setIsFlashing(true), 0)
    const endTimer = setTimeout(() => setIsFlashing(false), 3000)
    return () => {
      clearTimeout(startTimer)
      clearTimeout(endTimer)
    }
  }, [flash])

  const boxRef = useRef<HTMLDivElement>(null)
  const topLabelRef = useRef<HTMLSpanElement>(null)
  const bottomLabelRef = useRef<HTMLSpanElement>(null)

  const scaleLabels = useCallback(() => {
    const box = boxRef.current
    if (!box) return
    const boxWidth = box.offsetWidth
    for (const ref of [topLabelRef, bottomLabelRef]) {
      const el = ref.current
      if (!el) continue
      el.style.transform = ''
      const labelWidth = el.scrollWidth
      if (labelWidth > boxWidth) {
        el.style.transform = `scaleX(${boxWidth / labelWidth})`
      }
    }
  }, [])

  // biome-ignore lint/correctness/useExhaustiveDependencies: label/bottomLabel/size are intentional extra deps — label scaling must re-measure whenever the rendered text or size changes
  useEffect(() => {
    scaleLabels()
  }, [label, bottomLabel, size, scaleLabels])

  if (value === undefined) return null

  const numericValue = typeof value === 'number' ? value : Number(value)
  const canEdit = mode === 'edit' && onChange !== undefined && Number.isFinite(numericValue)
  const atMin = numericValue <= min
  const atMax = max !== undefined && numericValue >= max

  const boxSize: CSSProperties =
    size === 'mini'
      ? { height: space[32], minWidth: space[32], paddingInline: space[2] }
      : size === 'full'
        ? { height: space[64], minWidth: space[64], paddingInline: space[4] }
        : { height: space[48], width: space[48] }
  // Disabled state: reduce overall opacity to signal disabled while preserving
  // foreground/background contrast. The default paper / ink pair has a 16:1
  // base ratio; at 60% opacity the effective ratio is ~9.6:1, still well above
  // the WCAG AA threshold of 4.5:1 for normal text.
  const boxStyle = {
    ...boxSize,
    alignItems: 'center',
    backgroundColor: trueBg,
    borderColor: trueBorderColor,
    borderRadius: size === 'mini' ? radius.card : radius.panel,
    borderStyle: 'solid',
    borderWidth: size === 'mini' ? borderWidth.hairline : borderWidth.chrome,
    display: 'flex',
    justifyContent: 'center',
  } satisfies CSSProperties

  // The value readout: `current /max` (current prominent, /max muted) when a
  // max is set, else the bare value. The ink (or paper, inverted) stays on the
  // wrapper so the fill/value colour is constant across states.
  const valueReadout = (
    <span
      style={{
        alignItems: 'baseline',
        color: trueValueColor,
        display: 'flex',
        fontSize:
          size === 'mini' ? fontSize.xs : size === 'full' ? fontSize.display : fontSize.caption,
        fontWeight: weight.bold,
        gap: '1px',
        justifyContent: 'center',
        ...(size === 'mini' ? { lineHeight: LINE_HEIGHT_XS } : undefined),
        overflow: 'hidden',
        textAlign: 'center',
        whiteSpace: 'nowrap',
        width: '100%',
      }}
    >
      {value}
      {max !== undefined && (
        <span
          style={{
            color: mutedMaxColor,
            fontSize: size === 'full' ? fontSize.caption : fontSize.badge,
            fontWeight: weight.normal,
          }}
        >
          /{max}
        </span>
      )}
    </span>
  )

  // The stamps ride the box's top and bottom edges, overlapping it by 8px.
  const labelStampStyle = {
    alignSelf: 'center',
    display: 'block',
    fontSize: size === 'mini' ? fontSize.badge : fontSize.xs,
    lineHeight: 1,
    textTransform: 'uppercase',
    transformOrigin: 'center',
    whiteSpace: 'nowrap',
    zIndex: 1,
  } satisfies CSSProperties

  const boxClass = classes(
    state === 'modified' && STATE_RING_CLASS,
    isFlashing && 'su-stat__box--flash'
  )

  const box = (
    // biome-ignore lint/a11y/useSemanticElements: a <fieldset> would break the flex stat-box layout; role="group" carries the same semantics
    <div
      role="group"
      className={className}
      style={{
        alignItems: 'center',
        display: 'flex',
        flexDirection: 'column',
        gap: 0,
        overflow: 'visible',
        ...(size === 'mini' ? { minWidth: space[32] } : { width: space[48] }),
        ...(disabled ? { opacity: 0.6 } : undefined),
      }}
      aria-label={combinedAriaLabel}
    >
      {/*
       * `topLabelRef` MUST land on this DOM node — the overflow squeeze measures
       * the stamp's scrollWidth against the box. Badge forwards its ref to the
       * rendered element for exactly this reason.
       */}
      <Badge
        ref={topLabelRef}
        shape="stamp"
        size="mini"
        style={{ ...labelStampStyle, marginBottom: `-${space[8]}` }}
        id={labelId}
      >
        {label}
      </Badge>
      {onClick ? (
        <button
          ref={boxRef as React.Ref<HTMLButtonElement>}
          type="button"
          onClick={onClick}
          disabled={disabled}
          aria-disabled={disabled || undefined}
          className={classes(boxClass, !disabled && `su-stat__box--clickable ${FOCUS_RING}`)}
          style={{
            ...boxStyle,
            // Above `mini` the clickable box has always rendered borderless: its
            // `border-chrome` set a width but no style, so the button's reset
            // `none` held (the div box takes `solid` from the universal reset).
            ...(size === 'mini' ? undefined : { borderStyle: 'none' }),
            ...(disabled ? { pointerEvents: 'none' } : { cursor: 'pointer' }),
          }}
          aria-label={combinedAriaLabel}
        >
          {valueReadout}
        </button>
      ) : (
        <div ref={boxRef} className={boxClass} style={boxStyle}>
          {valueReadout}
        </div>
      )}
      <Badge
        ref={bottomLabelRef}
        shape="stamp"
        size="mini"
        style={{
          ...labelStampStyle,
          marginTop: `-${space[8]}`,
          ...(bottomLabel ? undefined : { visibility: 'hidden' }),
        }}
      >
        {bottomLabel || ' '}
      </Badge>
    </div>
  )

  // The steppers' resting fill/ink and the coarse-pointer 44px floor live in
  // classes (they flip on hover / at sm); the rest is static.
  const stepClass = (atLimit: boolean) =>
    classes(
      'su-stat-step su-stat-step--square',
      inverse ? 'su-stat-step--on-ink' : 'su-stat-step--on-paper',
      !atLimit && 'su-stat-step--live'
    )
  const stepSide = size === 'mini' ? '12px' : size === 'full' ? space[20] : space[16]
  const stepStyle = (atLimit: boolean) =>
    ({
      ...TRANSITION_COLORS,
      alignItems: 'center',
      borderRadius: radius.badge,
      cursor: atLimit ? 'not-allowed' : 'pointer',
      display: 'flex',
      fontFamily: font.body,
      fontSize: size === 'mini' ? fontSize.badge : size === 'full' ? fontSize.sm : fontSize.xs,
      fontWeight: weight.bold,
      height: stepSide,
      justifyContent: 'center',
      lineHeight: 1,
      width: stepSide,
      ...(atLimit ? { opacity: 0.3 } : undefined),
    }) satisfies CSSProperties

  // The ± column stretches to the box's full height and centres its buttons in
  // it, so the pair sits on the box's midline whatever the button count or size.
  //
  // Centring on the box centres on the value cell: the bottom label Badge is
  // always rendered (merely hidden when there is no bottom label), so the
  // box is symmetric about its cell, and no spacer stack has to track it.
  const content = canEdit ? (
    <div style={{ alignItems: 'stretch', display: 'flex', gap: space[2] }}>
      {box}
      <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: space[2],
            justifyContent: 'center',
          }}
        >
          <button
            type="button"
            aria-label={`Increase ${stepperLabel ?? label}`}
            onClick={() =>
              onChange?.(max !== undefined ? Math.min(max, numericValue + 1) : numericValue + 1)
            }
            disabled={!!atMax}
            className={stepClass(!!atMax)}
            style={stepStyle(!!atMax)}
          >
            +
          </button>
          <button
            type="button"
            aria-label={`Decrease ${stepperLabel ?? label}`}
            onClick={() => onChange?.(Math.max(min, numericValue - 1))}
            disabled={atMin}
            className={stepClass(atMin)}
            style={stepStyle(atMin)}
          >
            −
          </button>
        </div>
      </div>
    </div>
  ) : (
    box
  )

  if (hoverText) {
    return <Tooltip content={hoverText}>{content}</Tooltip>
  }

  return content
}
