import type { ReactElement } from 'react'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { EntitySchemaName, SURefEnumSchemaName } from 'salvageunion-reference'
import { EntitySchemaNames, SalvageUnionReference } from 'salvageunion-reference'
import type { SizeRung } from '../../styles/sizing'
import { cn } from '../../utils/cn'
import type { StampSurface } from '../chrome/Badge'
import { Badge } from '../chrome/Badge'
import { FOCUS_RING } from '../chrome/interaction'
import { EntityTooltip } from '../referenceEntity/EntityTooltip'
import { Tooltip } from '../ui/tooltip'
import type { EntityStatus } from './entityStatus'

/**
 * The canonical stat/value primitive (canonical primitive language §2). One
 * prop-controlled component with TWO anatomies — it absorbs the former
 * ValueDisplay (horizontal label|value) and StatControl (box + steppers):
 *
 *   orientation="horizontal"  -> the horizontal [label | value] cell, in either
 *                                material: `surface="plate"` (default, the
 *                                stamp pair) or `surface="plain"` (running
 *                                text — the former StatLine).
 *   (default)                 -> the centred value box with Badge stamps
 *                                above/below; mode="edit" adds +/- steppers.
 *
 * Both anatomies render ONE canonical ink-on-paper cell — no per-stat fill or
 * value colour. State is carried entirely by the BORDER colour via the `state`
 * prop (see StatBorderState); the fill/text/stamp stay constant. A value with a
 * `max` reads as `current /max` (current prominent, /max muted); a bare value
 * centres. Stat has NO pip mode: pip trackers were retired (use the value box; a
 * fill bar is `VitalGauge`), and the crawler-bay tally is its own `BayStatus`.
 */

/** Stat tone (a public alias retained for consumers that key colour by stat). */
export type StatTone = 'hp' | 'ap' | 'ep' | 'sp' | 'heat' | 'cargo' | 'cw' | 'default'
/** A tri-state condition value (crawler-bay condition — see `BayStatus`). */
export type StatState = EntityStatus

/**
 * The ONE lever that changes between stat states — it drives only the cell's
 * BORDER colour; fill, text, label and stamp are constant (canonical primitive
 * language: "hue encodes ontology; state is a treatment overlay"). Which value
 * maps to which state is the consumer's call ("at cap" is `good` for SP but
 * `critical` for Heat).
 *
 *   default  -> ink border (the resting state)
 *   good     -> mech   (full / at-cap-good — the former isOverMax)
 *   modified -> rust       (value changed from its base, e.g. a modified TL)
 *   caution  -> status-warn
 *   critical -> status-bad
 */
export type StatBorderState = 'default' | 'good' | 'modified' | 'caution' | 'critical'

const STATE_BORDER: Record<StatBorderState, string> = {
  default: 'border-ink',
  good: 'border-mech',
  modified: 'border-rust',
  caution: 'border-status-warn',
  critical: 'border-status-bad',
}

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
  | 'entityTooltip'
  | 'flash'
  | 'disabled'
  | 'state'
  | 'bgColor'
  | 'textColor'
  | 'inline'
  | 'labelId'
  | 'ariaLabel'
  | 'className'

/** `T`, plus every stat prop NOT in `T` forbidden (`?: never`) — the exclusion
 * that makes the anatomies genuinely non-overlapping at the type level. */
type Exact<T extends Partial<Record<StatPropKey, unknown>>> = T &
  Partial<Record<Exclude<StatPropKey, keyof T>, never>>

/** [horizontal] `orientation="horizontal"` — the former ValueDisplay. With
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
   * cell, so it defaults to `full`; `compact` is the listing-row scale (the
   * former `compact` boolean) and `mini` the seam-tag size (text-label / 10px,
   * the former `xs`). One axis — the old compact+xs boolean pair could be
   * combined into a rung that didn't exist; a single `size` cannot.
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
  /** When set, wrap the cell in the entity/keyword hover-tooltip (resolves
   * `label` within `schemaName`); unresolved refs render plain (no tooltip). */
  entityTooltip?: { schemaName: SURefEnumSchemaName; label: StatValue }
  /** Plain-text hover explanation (the stat's glossary line). Same contract as
   * the value box's `hoverText` — a compact header cell states the SAME stat as
   * the full box, so it must be able to explain itself too. */
  hoverText?: string
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
   * glance (the crawler economy's Scrap / Tech Level / Crew). It exists
   * because those readouts were previously hand-assembled in spans with an
   * arbitrary 26px numeral and a hand-built `/max` slash — the library's
   * worst §3.7 offender. Folding them onto Stat without a top rung shrank
   * them to a 13px annotation, which was a legible loss on a headline number.
   * The primitive was missing an anatomy, so the surface grew its own; the
   * fix is the rung, not the hand-rolled markup.
   *
   * One axis: the old `display` and `compact` booleans could contradict each
   * other; a single `size` cannot.
   */
  size?: SizeRung
  flash?: boolean
  inverse?: boolean
  hoverText?: string
  className?: string
}>

type StatProps = HorizontalValueProps | ValueBoxProps

/** Narrow a schema name to the entity subset `findIn` accepts. */
function isEntitySchemaName(
  value: SURefEnumSchemaName
): value is SURefEnumSchemaName & EntitySchemaName {
  const names: ReadonlySet<string> = EntitySchemaNames
  return names.has(value)
}

export function Stat(props: StatProps) {
  const inner = renderStat(props)
  const entityTooltip = 'entityTooltip' in props ? props.entityTooltip : undefined
  if (entityTooltip) {
    // Resolve the trait/keyword to a real entity; wrap in the hover-tooltip when
    // found (the former TraitKeywordDisplayView), else render plain.
    const { schemaName, label } = entityTooltip
    const entity = isEntitySchemaName(schemaName)
      ? SalvageUnionReference.findIn(
          schemaName,
          (t) => t.name.toLowerCase() === String(label).toLowerCase()
        )
      : undefined
    if (entity?.id) {
      return (
        <EntityTooltip schemaName={schemaName} entityId={entity.id} openDelay={300}>
          {inner}
        </EntityTooltip>
      )
    }
  }
  return inner
}

function renderStat(props: StatProps) {
  if (props.orientation === 'horizontal') return <HorizontalValue {...props} />
  return <ValueBox {...props} />
}

/* ------------------------------------------------------------------ *
 * Horizontal [label | value] — the former ValueDisplay. Ink/paper     *
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
  className,
}: HorizontalValueProps) {
  const fontSize = size === 'mini' ? 'text-label' : size === 'compact' ? 'text-xs' : 'text-sm'
  const fontWeight =
    size === 'mini' ? 'font-bold' : size === 'compact' ? 'font-normal' : 'font-semibold'
  const mainSurface: StampSurface = inverse ? 'inverse' : 'on-ink'
  const valueSurface: StampSurface = inverse ? 'on-ink' : 'inverse'
  // The CELL draws the single rounded border; the `inverse` plate's own inset
  // ring would double it, so both halves suppress it with `ring-0`.
  const plate = 'ring-0 leading-none'

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
      className={cn(
        'shrink-0 grow-0 cursor-default items-stretch overflow-hidden whitespace-nowrap rounded-badge border',
        STATE_BORDER[state],
        inline ? 'inline-flex' : 'flex',
        'w-fit',
        className
      )}
    >
      <Badge
        shape="stamp"
        size="mini"
        surface={mainSurface}
        className={cn(
          // Stretch to the FULL cell height (overriding the stamp's w-fit
          // inline-block) so the label's ink background always covers the whole
          // cell, and center the text vertically — even when the row stretches it.
          'flex items-center justify-center self-stretch uppercase',
          fontSize,
          fontWeight,
          // Two-line label cell (e.g. "Tech" / "Level") when a bottomLabel is set.
          bottomLabel !== undefined && 'flex-col',
          plate
        )}
        style={bgColor || textColor ? { backgroundColor: bgColor, color: textColor } : undefined}
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
          className={cn(
            'flex items-center gap-px self-stretch uppercase',
            fontSize,
            fontWeight,
            plate
          )}
        >
          {value}
          {max !== undefined && (
            <span className={cn('font-normal', inverse ? 'text-paper/70' : 'text-ink-2')}>
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
  // the stepper adds no vertical height to the row.
  const btnSize = size === 'compact' ? 'w-4 text-xs' : 'w-5 text-sm'
  const btnResting = inverse ? 'border-paper bg-ink text-paper' : 'border-ink bg-paper text-ink'
  const btnHover = inverse ? 'hover:bg-paper hover:text-ink' : 'hover:bg-ink hover:text-paper'
  const btnBase =
    'flex min-h-11 items-center justify-center rounded-badge border border-ink font-body font-bold leading-none transition-colors sm:min-h-0'

  const stepName = stepperLabel ?? label
  return withHover(
    <span className="inline-flex w-fit items-stretch gap-0.5">
      {cell}
      <button
        type="button"
        aria-label={`Decrease ${stepName}`}
        onClick={() => onChange?.(Math.max(min, numericValue - step))}
        disabled={atMin}
        className={cn(
          btnBase,
          btnSize,
          btnResting,
          atMin ? 'cursor-not-allowed opacity-30' : cn('cursor-pointer', btnHover)
        )}
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
        className={cn(
          btnBase,
          btnSize,
          btnResting,
          atMax ? 'cursor-not-allowed opacity-30' : cn('cursor-pointer', btnHover)
        )}
      >
        +
      </button>
    </span>
  )
}

/* ------------------------------------------------------------------ *
 * Centred value box — the former Stat; rounded, ink-on-paper.         *
 * A `max` reads as `current /max`; state rides the border.            *
 * mode="edit" grows the +/- stepper column (the former StatControl).  *
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
  const trueBg = inverse ? 'bg-ink' : 'bg-paper'
  const trueValueColor = inverse ? 'text-paper' : 'text-ink'
  const mutedMaxColor = inverse ? 'text-paper/70' : 'text-ink-2'
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
  const btnSize =
    size === 'mini' ? 'h-3 w-3 text-micro' : size === 'full' ? 'h-5 w-5 text-sm' : 'h-4 w-4 text-xs'
  const btnResting = inverse ? 'border-paper bg-ink text-paper' : 'border-ink bg-paper text-ink'
  const btnHover = inverse ? 'hover:bg-paper hover:text-ink' : 'hover:bg-ink hover:text-paper'

  const boxSize =
    size === 'mini' ? 'h-8 min-w-8 px-0.5' : size === 'full' ? 'h-16 min-w-16 px-1' : 'h-12 w-12'
  const boxRadius = size === 'mini' ? 'rounded-card' : 'rounded-panel'
  // Disabled state: reduce overall opacity to signal disabled while preserving
  // foreground/background contrast. The default bg-paper / text-ink pair
  // has a 16:1 base ratio; at 60% opacity the effective ratio is ~9.6:1, still
  // well above the WCAG AA threshold of 4.5:1 for normal text.
  const disabledClass = disabled ? 'opacity-60' : ''

  // The value readout: `current /max` (current prominent, /max muted) when a
  // max is set, else the bare value. `text-ink` (or paper, inverted) stays
  // on the wrapper so the fill/value colour is constant across states.
  const valueReadout = (
    <span
      className={cn(
        'flex w-full items-baseline justify-center gap-px overflow-hidden whitespace-nowrap text-center font-bold',
        trueValueColor,
        size === 'mini' ? 'text-xs' : size === 'full' ? 'text-display' : 'text-caption'
      )}
    >
      {value}
      {max !== undefined && (
        <span
          className={cn(
            'font-normal',
            mutedMaxColor,
            size === 'mini' ? 'text-micro' : size === 'full' ? 'text-caption' : 'text-label'
          )}
        >
          /{max}
        </span>
      )}
    </span>
  )

  const box = (
    // biome-ignore lint/a11y/useSemanticElements: a <fieldset> would break the flex stat-box layout; role="group" carries the same semantics
    <div
      role="group"
      className={cn(
        'flex flex-col items-center gap-0 overflow-visible',
        size === 'mini' ? 'min-w-8' : 'w-12',
        disabledClass,
        className
      )}
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
        className={cn(
          'block z-[1] -mb-2 origin-center self-center whitespace-nowrap uppercase',
          size === 'mini' ? 'text-label' : 'text-xs',
          'leading-none'
        )}
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
          className={cn(
            'flex items-center justify-center border',
            boxSize,
            boxRadius,
            trueBg,
            trueBorderColor,
            size === 'mini' ? 'border' : 'border-chrome',
            disabled ? 'pointer-events-none' : cn('cursor-pointer hover:opacity-80', FOCUS_RING),
            isFlashing && 'animate-[growShrink_3s_ease-out] motion-reduce:animate-none'
          )}
          aria-label={combinedAriaLabel}
        >
          {valueReadout}
        </button>
      ) : (
        <div
          ref={boxRef}
          className={cn(
            'flex items-center justify-center border',
            boxSize,
            boxRadius,
            trueBg,
            trueBorderColor,
            size === 'mini' ? 'border' : 'border-chrome',
            isFlashing && 'animate-[growShrink_3s_ease-out] motion-reduce:animate-none'
          )}
        >
          {valueReadout}
        </div>
      )}
      <Badge
        ref={bottomLabelRef}
        shape="stamp"
        size="mini"
        className={cn(
          'block z-[1] -mt-2 origin-center self-center whitespace-nowrap uppercase',
          size === 'mini' ? 'text-label' : 'text-xs',
          'leading-none',
          !bottomLabel && 'invisible'
        )}
      >
        {bottomLabel || ' '}
      </Badge>
    </div>
  )

  // The ± column stretches to the box's full height and centres its buttons in
  // it, so the pair sits on the box's midline whatever the button count or size.
  //
  // This previously mirrored the box's [label][cell][label] stack with a pair of
  // invisible label-height spacers, on the reasoning that the buttons should
  // align to the value CELL rather than the label-inclusive box. That
  // indirection is unnecessary: the bottom label Badge is always rendered
  // (merely `invisible` when there is no bottom label), so the box is symmetric
  // about its cell and centring on the box centres on the cell. Rebuilding the
  // stack by hand also had to be kept in sync with it, and had drifted — the
  // buttons were riding high.
  const content = canEdit ? (
    <div className="flex items-stretch gap-0.5">
      {box}
      <div className="flex flex-col justify-center">
        <div className="flex flex-col justify-center gap-0.5">
          <button
            type="button"
            aria-label={`Increase ${stepperLabel ?? label}`}
            onClick={() =>
              onChange?.(max !== undefined ? Math.min(max, numericValue + 1) : numericValue + 1)
            }
            disabled={!!atMax}
            className={`flex min-h-11 min-w-11 items-center justify-center rounded-badge border-chrome font-body font-bold leading-none transition-colors sm:min-h-0 sm:min-w-0 ${btnSize} ${btnResting} ${
              atMax ? 'cursor-not-allowed opacity-30' : `cursor-pointer ${btnHover}`
            }`}
          >
            +
          </button>
          <button
            type="button"
            aria-label={`Decrease ${stepperLabel ?? label}`}
            onClick={() => onChange?.(Math.max(min, numericValue - 1))}
            disabled={atMin}
            className={`flex min-h-11 min-w-11 items-center justify-center rounded-badge border-chrome font-body font-bold leading-none transition-colors sm:min-h-0 sm:min-w-0 ${btnSize} ${btnResting} ${
              atMin ? 'cursor-not-allowed opacity-30' : `cursor-pointer ${btnHover}`
            }`}
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
