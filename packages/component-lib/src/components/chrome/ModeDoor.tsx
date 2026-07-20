import type { ReactNode } from 'react'
import { cn } from '../../utils/cn'
import { FOCUS_RING } from './interaction'

type ModeDoorProps = {
  /**
   * `guided` — the filled-tone primary with a permanent double-ink halo.
   * `blank` — the dashed paper escape hatch. Default `guided`.
   */
  variant?: 'guided' | 'blank'
  /** Overhanging notched ink tab content — a glyph char (▶ / ✎) or a Glyph node. */
  tab: ReactNode
  headline: string
  /** Body copy. */
  children: ReactNode
  cite?: ReactNode
  onSelect?: () => void
  className?: string
}

const DOOR_BASE =
  'relative min-h-[170px] cursor-pointer rounded-xl p-[22px] pb-5 pl-[26px] text-left transition-transform duration-[120ms] hover:-translate-y-0.5'
const TAB =
  'absolute -left-3.5 top-[18px] grid h-12 w-11 place-items-center rounded-[2px] bg-ink font-cond text-[22px] font-bold text-paper shadow-[0_8px_14px_-8px_rgba(0,0,0,0.55)]'
const HEAD =
  'mb-1.5 ml-[34px] block font-cond text-[27px] font-bold uppercase leading-none tracking-caps-tight'
const BODY = 'ml-[34px] block font-body text-[13px] leading-[1.55] text-ink'
const CITE = 'ml-[34px] mt-2.5 block font-body text-[12.5px] font-bold text-ink'

/** guided emphasis: a ground gap, a 3px ink ring, then a soft drop shadow. */
const GUIDED_HALO =
  'shadow-[0_0_0_3px_var(--ground),0_0_0_7px_var(--color-ink),0_18px_30px_-14px_rgba(0,0,0,0.5)]'

/**
 * ModeDoor — the onboarding "choose how to create" poster card (mockup `.door`,
 * design handoff): a large selectable path-card with a notched ink tab
 * overhanging the left edge, a condensed-caps headline, body copy, and an
 * optional citation. `guided` is the filled-tone primary; `blank` is the dashed
 * paper escape hatch. Extracted from the copy duplicated verbatim across
 * `CreateModeChooser` + `NewEntityScreen`.
 */
export function ModeDoor({
  variant = 'guided',
  tab,
  headline,
  children,
  cite,
  onSelect,
  className,
}: ModeDoorProps) {
  const guided = variant === 'guided'
  return (
    <button
      type="button"
      onClick={onSelect}
      // The guided plate always fills with the surrounding surface tone.
      style={guided ? { background: 'var(--tone)' } : undefined}
      className={cn(
        DOOR_BASE,
        FOCUS_RING,
        guided
          ? GUIDED_HALO
          : 'border-entity border-dashed border-ink/55 bg-paper text-ink shadow-[0_14px_26px_-14px_rgba(0,0,0,0.4)]',
        className
      )}
    >
      <span className={TAB} aria-hidden="true">
        {tab}
      </span>
      <span
        className={cn(
          HEAD,
          guided ? 'text-paper [text-shadow:0_1px_0_rgba(0,0,0,0.38)]' : 'text-ink'
        )}
      >
        {headline}
      </span>
      <span className={BODY}>{children}</span>
      {cite && <span className={CITE}>{cite}</span>}
    </button>
  )
}
