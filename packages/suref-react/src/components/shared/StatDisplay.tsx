import { useState, useEffect, useRef, useCallback } from 'react'
import { cn } from '../../utils/cn'
import { Text } from '../base/Text'
import { Tooltip } from '../ui/tooltip'
import { StepBtn } from '../chrome/SmallButtons'
import { statBlockRowStarts, pipClickValue, trackSegmentState } from '../stat/pipRows'
import { heatDangerFrom, heatLevel } from '../stat/heatLevel'
import { ConditionSwatch } from '../stat/ConditionSwatch'

/**
 * The single canonical stat/value primitive (canonical primitive language §2).
 * One prop-controlled component that renders three anatomies — it absorbs the
 * former StatBlock (framed tracker), ValueDisplay (horizontal label|value) and
 * StatControl (box + steppers), and replaces MiniStat:
 *
 *   orientation="horizontal"  -> the horizontal black/white [label | value].
 *   dots (or states[])        -> the framed tracker: black code tab, big
 *                                numeral, pip track / bay tally, unit bar,
 *                                steppers, tones + heat escalation.
 *   (default)                 -> the centred value box with pseudoheader stamps
 *                                above/below; mode="edit" adds +/- steppers.
 *
 * The three renders are the verbatim originals behind one API, so migrating a
 * call site is a prop remap — no visual drift.
 */

/** Pip / fill semantics: hp red, ap/ep rust, heat warn, cargo bronze, cw crawler pink, sp/default ink. */
export type StatTone = 'hp' | 'ap' | 'ep' | 'sp' | 'heat' | 'cargo' | 'cw' | 'default'
/** Tri-state tally entry for the `states[]` mode (crawler bays). */
export type StatState = 'intact' | 'damaged' | 'destroyed'

const PIP_FILL: Record<StatTone, string> = {
  hp: 'border-status-bad bg-status-bad',
  ap: 'border-rust bg-rust',
  ep: 'border-rust bg-rust',
  heat: 'border-status-warn bg-status-warn',
  cargo: 'border-cargo bg-cargo',
  cw: 'border-crawler bg-crawler',
  sp: 'border-ink bg-ink',
  default: 'border-ink bg-ink',
}

type StatDisplayProps = {
  /** Header code / label ('HP', 'STRUCTURE', 'Range', or a numeric tier). */
  label: string | number
  value?: number | string
  /** Track maximum (framed tracker) or the /max shown beside the value. */
  max?: number
  /** Minimum for edit-mode steppers (box). */
  min?: number
  /** Bottom pseudoheader stamp (box anatomy). */
  bottomLabel?: string
  /** Muted right-side header name (framed tracker). */
  name?: string
  /** Black footer unit bar (framed tracker), e.g. 'POINTS'. */
  unit?: string

  /** 'horizontal' selects the [label | value] anatomy; default 'vertical'. */
  orientation?: 'vertical' | 'horizontal'
  /** true selects the framed pip-track tracker anatomy. */
  dots?: boolean
  /** 'edit' adds steppers (box + tracker). */
  mode?: 'read' | 'edit'
  /** lg (sheet hero) or sm (rail / NPC / spec strip) — framed tracker. */
  size?: 'lg' | 'sm'
  /** Pip fill semantics (framed tracker). */
  tone?: StatTone
  /** Tri-state tally mode (crawler bays) — replaces the numeric track. */
  states?: StatState[]

  inverse?: boolean
  compact?: boolean

  /** Uncontrolled initial value (framed tracker self-managed state). */
  init?: number
  onChange?: (value: number) => void
  /** Force editability on/off (framed tracker); derived otherwise. */
  editable?: boolean
  /** Set false to suppress pips even with a max (framed tracker). */
  pips?: boolean
  /** Click handler per states[] pip (framed tracker). */
  onBay?: (index: number) => void

  onClick?: () => void
  hoverText?: string
  flash?: boolean
  disabled?: boolean
  isOverMax?: boolean

  /** Value-box colour overrides. */
  bg?: string
  valueColor?: string
  borderColor?: string
  /** Horizontal-anatomy colour overrides. */
  bgColor?: string
  textColor?: string
  /** Horizontal anatomy: inline-flex (default) vs flex. */
  inline?: boolean
  labelId?: string
  ariaLabel?: string
  className?: string
}

export function StatDisplay(props: StatDisplayProps) {
  if (props.orientation === 'horizontal') {
    return props.dots ? <InlineChip {...props} /> : <HorizontalValue {...props} />
  }
  if (props.dots || props.states !== undefined) return <FramedTracker {...props} />
  return <ValueBox {...props} />
}

/* ------------------------------------------------------------------ *
 * Horizontal [label | value] — the former ValueDisplay. Black/white   *
 * pseudoheader pair; the combo is inviolable.                         *
 * ------------------------------------------------------------------ */
function HorizontalValue({
  label,
  value,
  compact = false,
  inverse = false,
  inline = true,
  bgColor,
  textColor,
  borderColor,
}: StatDisplayProps) {
  const fontSize = compact ? 'text-xs' : 'text-sm'
  const mainVariant = inverse ? 'pseudoheaderInverse' : 'pseudoheader'
  const valueVariant = inverse ? 'pseudoheader' : 'pseudoheaderInverse'

  return (
    <span
      className={cn(
        'shrink-0 grow-0 cursor-default whitespace-nowrap border border-su-black',
        inline ? 'inline-flex' : 'flex',
        'w-fit'
      )}
      style={borderColor ? { borderColor } : undefined}
    >
      <Text
        variant={mainVariant}
        as="span"
        className={cn('uppercase', fontSize, compact ? 'font-normal' : 'font-semibold')}
        style={bgColor || textColor ? { backgroundColor: bgColor, color: textColor } : undefined}
      >
        {label}
      </Text>
      {value !== undefined && (
        <Text
          variant={valueVariant}
          as="span"
          className={cn('uppercase', fontSize, compact ? 'font-normal' : 'font-semibold')}
        >
          {value}
        </Text>
      )}
    </span>
  )
}

/* ------------------------------------------------------------------ *
 * Inline chip — the former MiniStat. Condensed [label · pips · value]  *
 * for the live condensed bar; pips render only when max <= 12.         *
 * ------------------------------------------------------------------ */
const CHIP_PIP_MAX = 12

function InlineChip({ label, value, max, tone = 'default', className }: StatDisplayProps) {
  const v = typeof value === 'number' ? value : Number(value)
  // Over-capacity honesty: the derived mech Hold (cargo tone) can exceed its
  // soft cap — show the true value + red over-pips rather than clamping to a lie.
  const isOver = tone === 'cargo' && max !== undefined && v > max
  const clamped = isOver ? v : Math.max(0, max !== undefined ? Math.min(v, max) : v)
  const total = isOver ? v : (max ?? 0)
  const showPips = max !== undefined && max > 0 && total <= CHIP_PIP_MAX

  const level = tone === 'heat' ? heatLevel(clamped, max) : 'normal'
  const heatDanger =
    tone === 'heat' && max !== undefined && max > 0 ? heatDangerFrom(max) : Infinity

  return (
    // biome-ignore lint/a11y/useSemanticElements: a <fieldset> cannot render as an inline stat chip; role="group" carries the same semantics
    <span
      role="group"
      aria-label={`${label} ${clamped}${max !== undefined ? ` of ${max}` : ''}${
        isOver ? ' — over capacity' : ''
      }`}
      data-heat={level !== 'normal' ? level : undefined}
      className={cn(
        'inline-flex w-fit items-stretch whitespace-nowrap border',
        level === 'critical' ? 'border-status-bad motion-safe:animate-heat-pulse' : 'border-ink',
        className
      )}
    >
      {/* Ink stamp label cell — the [RANGE | CLOSE] horizontal split-stat style. */}
      <span className="flex items-center bg-ink px-1.5 font-cond text-label font-bold uppercase leading-none tracking-caps-tight text-paper">
        {label}
      </span>
      {/* White value cell — the pip-chips + value live in the white "close" section. */}
      <span className="flex items-center gap-1.5 bg-paper px-1.5 py-0.5">
        {showPips && (
          <span className="flex items-center gap-[3px]" aria-hidden="true">
            {Array.from({ length: total }).map((_, i) => (
              <span
                // biome-ignore lint/suspicious/noArrayIndexKey: pips are positional — the index IS their identity
                key={i}
                data-pip={i < clamped ? 'on' : 'off'}
                className={cn(
                  'h-[7px] w-[7px] rounded-pip border-[1.25px]',
                  i < clamped
                    ? i >= (max ?? Infinity) || i >= heatDanger
                      ? 'border-status-bad bg-status-bad'
                      : PIP_FILL[tone]
                    : 'border-ink bg-transparent'
                )}
              />
            ))}
          </span>
        )}
        <span
          className={cn(
            'font-body text-sm font-bold leading-none',
            level !== 'normal' || isOver ? 'text-status-bad' : 'text-ink'
          )}
        >
          {clamped}
          {max !== undefined && (
            <small className="text-label font-bold text-wk-muted">/{max}</small>
          )}
        </span>
      </span>
    </span>
  )
}

/* ------------------------------------------------------------------ *
 * Framed tracker — the former StatBlock. Black code tab, numeral +    *
 * steppers, pip track / bay tally, black unit bar, tones + heat.      *
 * ------------------------------------------------------------------ */
function FramedTracker({
  label: code,
  name,
  unit,
  tone = 'default',
  size = 'lg',
  max,
  value: valueProp,
  init,
  onChange,
  editable,
  mode,
  pips = true,
  states,
  onBay,
  className,
}: StatDisplayProps) {
  const isControlled = valueProp !== undefined
  const numericProp = typeof valueProp === 'number' ? valueProp : undefined
  const [internal, setInternal] = useState(init ?? max ?? 0)
  const rawValue = isControlled ? (numericProp ?? 0) : internal
  const clamp = (v: number) => Math.max(0, max !== undefined ? Math.min(v, max) : v)

  const isEditable = editable ?? (mode === 'edit' || onChange !== undefined || !isControlled)

  const isOver = !isEditable && max !== undefined && rawValue > max
  const value = isOver ? rawValue : clamp(rawValue)

  const setValue = (next: number) => {
    if (!isEditable) return
    const clamped = clamp(next)
    if (!isControlled) setInternal(clamped)
    onChange?.(clamped)
  }

  const isStates = states !== undefined
  const isSm = size === 'sm'
  const showSteppers = !isStates && !isSm && isEditable
  const showPips = !isStates && pips && max !== undefined && max > 0

  const isHeat = tone === 'heat'
  const level = isHeat && !isStates ? heatLevel(value, max) : 'normal'
  const heatDanger = isHeat && max !== undefined && max > 0 ? heatDangerFrom(max) : Infinity

  const pipFill = PIP_FILL[tone]
  const pipBox = isSm
    ? 'h-2 w-2 rounded-pip border-[1.25px]'
    : 'h-[13px] w-[13px] rounded-badge border-chrome'

  const tallies: { state: StatState; count: number }[] = isStates
    ? (['intact', 'damaged', 'destroyed'] as const)
        .map((state) => ({
          state,
          count: states.filter((s) => s === state).length,
        }))
        .filter((t) => t.count > 0)
    : []

  return (
    // biome-ignore lint/a11y/useSemanticElements: a <fieldset> would break the inline-flex stat-block chrome; role="group" carries the same semantics
    <span
      role="group"
      aria-label={
        isStates
          ? `${code} ${states.length} bays`
          : `${code} ${value}${max !== undefined ? ` of ${max}` : ''}${
              isOver ? ' — over capacity' : ''
            }`
      }
      data-heat={level !== 'normal' ? level : undefined}
      className={cn('inline-flex flex-col items-center', isSm && 'min-w-[96px]', className)}
    >
      {/* Code stamp riding the framed body's top border (StampSeam), not a header tab. */}
      <span className="z-[1] -mb-2 self-center bg-ink px-1.5 py-0.5 font-cond text-xs font-bold uppercase leading-none tracking-caps-wide text-paper">
        {code}
      </span>
      {name && (
        <span className="-mb-1 font-cond text-micro uppercase leading-none text-wk-muted">
          {name}
        </span>
      )}
      {/* Framed body */}
      <div
        className={cn(
          'flex w-full flex-col overflow-hidden rounded-card border-2 bg-paper pt-3 shadow-[0_2px_6px_-2px_rgba(40,32,25,0.4)]',
          level === 'critical' ? 'border-status-bad motion-safe:animate-heat-pulse' : 'border-ink'
        )}
      >
        {/* Main row: steppers + value, or the bay tally */}
        {isStates ? (
          <div className="flex items-center justify-center gap-3 px-2.5 py-1.5">
            {tallies.map(({ state, count }) => (
              <span key={state} className="flex items-center gap-1.5">
                <ConditionSwatch state={state} aria-hidden="true" className="size-[11px]" />
                <span className="font-body text-[17px] font-bold leading-none text-ink">
                  {count}
                </span>
                <span className="font-cond text-[9.5px] uppercase leading-none text-wk-muted">
                  {state}
                </span>
              </span>
            ))}
          </div>
        ) : (
          <div className="flex items-center justify-center gap-2 px-2.5 py-1.5">
            {showSteppers && (
              <StepBtn aria-label={`Decrease ${code}`} onClick={() => setValue(value - 1)}>
                –
              </StepBtn>
            )}
            <span
              className={cn(
                'font-body font-bold leading-none',
                isSm ? 'text-base' : 'text-[23px]',
                isOver ? 'text-status-bad' : 'text-ink'
              )}
            >
              {value}
              {max !== undefined && (
                <small
                  className={cn(
                    'font-bold',
                    isSm ? 'text-label' : 'text-caption',
                    isOver ? 'text-status-bad' : 'text-wk-muted'
                  )}
                >
                  /{max}
                </small>
              )}
            </span>
            {showSteppers && (
              <StepBtn aria-label={`Increase ${code}`} onClick={() => setValue(value + 1)}>
                +
              </StepBtn>
            )}
          </div>
        )}

        {/* Pip track */}
        {isStates ? (
          <div className="flex flex-col items-center gap-1 px-2.5 pb-2">
            {statBlockRowStarts(states.length).map(({ count, start }, r) => {
              return (
                // biome-ignore lint/suspicious/noArrayIndexKey: pip rows are positional — the row index IS their identity
                <div key={r} className="flex justify-center gap-1">
                  {Array.from({ length: count }).map((_, c) => {
                    const i = start + c
                    const state = states[i]
                    if (!state) return null
                    const title = `Bay ${i + 1} · ${state}`
                    return onBay ? (
                      <button
                        key={i}
                        type="button"
                        title={title}
                        aria-label={title}
                        onClick={() => onBay(i)}
                        className="inline-flex cursor-pointer"
                      >
                        <ConditionSwatch state={state} aria-hidden="true" className={pipBox} />
                      </button>
                    ) : (
                      <span key={i} title={title} className="inline-flex">
                        <ConditionSwatch state={state} aria-hidden="true" className={pipBox} />
                      </span>
                    )
                  })}
                </div>
              )
            })}
          </div>
        ) : (
          showPips && (
            <div
              className="flex flex-col items-center gap-1 px-2.5 pb-2"
              role="img"
              aria-label={`${value} of ${max}${isOver ? ' — over capacity' : ''}`}
            >
              {statBlockRowStarts(Math.max(max ?? 0, value)).map(({ count, start }, r) => {
                return (
                  // biome-ignore lint/suspicious/noArrayIndexKey: pip rows are positional — the row index IS their identity
                  <div key={r} className="flex justify-center gap-1">
                    {Array.from({ length: count }).map((_, c) => {
                      const i = start + c
                      const state = trackSegmentState(
                        i,
                        value,
                        max ?? Number.POSITIVE_INFINITY,
                        heatDanger
                      )
                      const on = state !== 'off'
                      const pipClass = cn(
                        pipBox,
                        state === 'off'
                          ? 'border-ink bg-transparent'
                          : state === 'danger'
                            ? 'border-status-bad bg-status-bad'
                            : pipFill
                      )
                      return isEditable ? (
                        <button
                          key={i}
                          type="button"
                          tabIndex={-1}
                          aria-hidden="true"
                          data-pip={on ? 'on' : 'off'}
                          onClick={() => setValue(pipClickValue(i, value))}
                          className={cn(pipClass, 'cursor-pointer')}
                        />
                      ) : (
                        <span key={i} data-pip={on ? 'on' : 'off'} className={pipClass} />
                      )
                    })}
                  </div>
                )
              })}
            </div>
          )
        )}
      </div>
      {/* Unit stamp riding the framed body's BOTTOM border (StampSeam),
          mirroring the code stamp on the top border. */}
      {unit && (
        <span className="z-[1] -mt-2 self-center bg-ink px-1.5 py-0.5 font-cond text-[9.5px] font-bold uppercase leading-none tracking-caps-wide text-paper">
          {unit}
        </span>
      )}
    </span>
  )
}

/* ------------------------------------------------------------------ *
 * Centred value box — the former StatDisplay; mode="edit" grows the   *
 * +/- stepper column (the former StatControl).                        *
 * ------------------------------------------------------------------ */
function ValueBox({
  label,
  value,
  max,
  min = 0,
  bottomLabel,
  labelId,
  disabled,
  onClick,
  onChange,
  mode = 'read',
  bg = 'bg-paper',
  valueColor = 'text-su-black',
  borderColor = 'border-su-black',
  ariaLabel,
  compact = false,
  flash = false,
  inverse = false,
  isOverMax = false,
  hoverText,
}: StatDisplayProps) {
  const [isFlashing, setIsFlashing] = useState(false)

  const combinedAriaLabel = ariaLabel || (bottomLabel ? `${label} ${bottomLabel}` : String(label))
  const trueBg = inverse ? 'bg-su-black' : bg
  const trueValueColor = inverse ? 'text-paper' : valueColor
  const trueBorderColor = isOverMax ? 'border-su-green' : borderColor

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

  // biome-ignore lint/correctness/useExhaustiveDependencies: label/bottomLabel/compact are intentional extra deps — label scaling must re-measure whenever the rendered text or size changes
  useEffect(() => {
    scaleLabels()
  }, [label, bottomLabel, compact, scaleLabels])

  if (value === undefined) return null

  const numericValue = typeof value === 'number' ? value : Number(value)
  const canEdit = mode === 'edit' && onChange !== undefined && Number.isFinite(numericValue)
  const atMin = numericValue <= min
  const atMax = max !== undefined && numericValue >= max
  const btnSize = compact ? 'h-3 w-3 text-micro' : 'h-4 w-4 text-xs'
  // Match the canonical button border (border-chrome border-ink bg-paper), same
  // as Btn / StepBtn; keep the invert-on-hover the box steppers have always had.
  const btnResting = inverse
    ? 'border-paper bg-su-black text-paper'
    : 'border-ink bg-paper text-ink'
  const btnHover = inverse ? 'hover:bg-paper hover:text-su-black' : 'hover:bg-ink hover:text-paper'

  const boxSize = compact ? 'h-8 min-w-8 px-0.5' : 'h-12 w-12'
  // Disabled state: reduce overall opacity to signal disabled while preserving
  // foreground/background contrast. The default bg-paper / text-su-black pair
  // has a 16:1 base ratio; at 60% opacity the effective ratio is ~9.6:1, still
  // well above the WCAG AA threshold of 4.5:1 for normal text.
  const disabledClass = disabled ? 'opacity-60' : ''

  const box = (
    // biome-ignore lint/a11y/useSemanticElements: a <fieldset> would break the flex stat-box layout; role="group" carries the same semantics
    <div
      role="group"
      className={cn(
        'flex flex-col items-center gap-0 overflow-visible',
        compact ? 'min-w-8' : 'w-12',
        disabledClass
      )}
      aria-label={combinedAriaLabel}
    >
      <Text
        ref={topLabelRef}
        variant="pseudoheader"
        as="span"
        className={cn(
          'z-[1] -mb-2 origin-center self-center whitespace-nowrap uppercase',
          compact ? 'text-label' : 'text-xs'
        )}
        id={labelId}
      >
        {label}
      </Text>
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
            trueBg,
            trueBorderColor,
            compact ? 'border' : 'border-chrome',
            disabled
              ? 'pointer-events-none'
              : 'cursor-pointer hover:opacity-80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-su-orange',
            isFlashing && 'animate-[growShrink_3s_ease-out] motion-reduce:animate-none'
          )}
          aria-label={combinedAriaLabel}
        >
          <span
            className={cn(
              'w-full overflow-hidden whitespace-nowrap text-center font-bold',
              trueValueColor,
              compact ? 'text-xs' : 'text-[0.85rem]'
            )}
          >
            {max !== undefined ? `${value}/${max}` : value}
          </span>
        </button>
      ) : (
        <div
          ref={boxRef}
          className={cn(
            'flex items-center justify-center border',
            boxSize,
            trueBg,
            trueBorderColor,
            compact ? 'border' : 'border-chrome',
            isFlashing && 'animate-[growShrink_3s_ease-out] motion-reduce:animate-none'
          )}
        >
          <span
            className={cn(
              'w-full overflow-hidden whitespace-nowrap text-center font-bold',
              trueValueColor,
              compact ? 'text-xs' : 'text-[0.85rem]'
            )}
          >
            {max !== undefined ? `${value}/${max}` : value}
          </span>
        </div>
      )}
      <Text
        ref={bottomLabelRef}
        variant="pseudoheader"
        as="span"
        className={cn(
          'z-[1] -mt-2 origin-center self-center whitespace-nowrap uppercase',
          compact ? 'text-label' : 'text-xs',
          !bottomLabel && 'invisible'
        )}
      >
        {bottomLabel || ' '}
      </Text>
    </div>
  )

  const content = canEdit ? (
    <div className="flex items-center gap-0.5">
      {box}
      <div className="flex flex-col gap-0.5">
        <button
          type="button"
          aria-label={`Increase ${label}`}
          onClick={() =>
            onChange?.(max !== undefined ? Math.min(max, numericValue + 1) : numericValue + 1)
          }
          disabled={!!atMax}
          className={`flex min-h-11 min-w-11 items-center justify-center border-chrome font-mono font-bold leading-none transition-colors sm:min-h-0 sm:min-w-0 ${btnSize} ${btnResting} ${
            atMax ? 'cursor-not-allowed opacity-30' : `cursor-pointer ${btnHover}`
          }`}
        >
          +
        </button>
        <button
          type="button"
          aria-label={`Decrease ${label}`}
          onClick={() => onChange?.(Math.max(min, numericValue - 1))}
          disabled={atMin}
          className={`flex min-h-11 min-w-11 items-center justify-center border-chrome font-mono font-bold leading-none transition-colors sm:min-h-0 sm:min-w-0 ${btnSize} ${btnResting} ${
            atMin ? 'cursor-not-allowed opacity-30' : `cursor-pointer ${btnHover}`
          }`}
        >
          −
        </button>
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
