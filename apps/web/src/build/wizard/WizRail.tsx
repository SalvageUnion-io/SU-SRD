/**
 * WizRail — the wizard's stepper rail, out of `WizShell`: the manual's
 * connector pipe from lg, a row of number tabs under it, a step line over
 * notches on a phone.
 */

import { Check } from 'lucide-react'
import type { CSSProperties } from 'react'
import { TrackStep } from '../../components/app'
import { capsLabel, tokens } from '../../components/index'
import { cn } from '../../lib/cn'
import { buildWizardCopy } from '../../messages/build-wizard'

/** Its vertical margin opens at lg, and a disabled tab ignores the pointer
 *  (`.su-wiz-rail-step`). */
const railStepStyle = {
  alignItems: 'center',
  display: 'flex',
  gap: tokens.space[8],
  position: 'relative',
  textAlign: 'left',
  zIndex: 1,
} satisfies CSSProperties satisfies CSSProperties

const railStepClickableStyle = { ...railStepStyle, cursor: 'pointer' } satisfies CSSProperties

const railTabStyle = {
  borderRadius: tokens.radius.badge,
  display: 'grid',
  flexShrink: 0,
  fontFamily: tokens.font.cond,
  fontWeight: tokens.weight.bold,
  placeItems: 'center',
} satisfies CSSProperties

/** A tab's size is `.su-wiz-rail-tab`'s: a notch on a phone, a number block
 *  from sm. Its lg pull-left is `.su-wiz-rail-tab--active`. */
const railTabActiveStyle = {
  ...railTabStyle,
  backgroundColor: tokens.color.ink,
  boxShadow: '0 0 0 4px var(--tone)',
  color: tokens.color.paper,
  lineHeight: 1,
} satisfies CSSProperties

const railTabDoneStyle = {
  ...railTabStyle,
  backgroundColor: tokens.color.ink,
  color: tokens.color.pilot,
} satisfies CSSProperties

const railTabFutureStyle = {
  ...railTabStyle,
  backgroundColor: tokens.color.paper,
  boxShadow: 'inset 0 0 0 2.5px var(--color-ink)',
  color: tokens.color.ink,
} satisfies CSSProperties

/**
 * Hidden until 721px (`.su-wiz-rail-label`). No lineHeight: the label inherits
 * its line height, and that is the rendered look. Don't add one.
 */
const railLabelStyle = {
  color: tokens.color.ink,
} satisfies CSSProperties
const railLabelCaps = capsLabel({ tracking: 'snug' })

const railLabelActiveStyle = {
  ...railLabelStyle,
  fontSize: tokens.fontSize.caption,
} satisfies CSSProperties

const railLabelDoneStyle = {
  ...railLabelStyle,
  fontSize: tokens.fontSize.chip,
  opacity: 0.8,
} satisfies CSSProperties

const railLabelFutureStyle = {
  ...railLabelStyle,
  fontSize: tokens.fontSize.chip,
  opacity: 0.66,
} satisfies CSSProperties

/** Connector-pipe rail entry — one step tab + label. */
function RailStep({
  label,
  index,
  active,
  done,
  clickable,
  onClick,
}: {
  label: string
  index: number
  active: boolean
  done: boolean
  clickable: boolean
  onClick?: () => void
}) {
  return (
    <TrackStep
      disabled={!clickable && !active}
      aria-current={active ? 'step' : undefined}
      onClick={clickable ? onClick : undefined}
      className="su-wiz-rail-step"
      style={clickable ? railStepClickableStyle : railStepStyle}
    >
      {/* Sharp ink number tab: done = amber check, active = enlarged + tone
          ring, future = hollow ink-outlined block (never opacity-faded). */}
      <span
        aria-hidden="true"
        className={cn('su-wiz-rail-tab', active && 'su-wiz-rail-tab--active')}
        style={active ? railTabActiveStyle : done ? railTabDoneStyle : railTabFutureStyle}
      >
        {done ? <Check size={tokens.iconSize.full} /> : index + 1}
      </span>
      <span
        className={cn('su-wiz-rail-label', railLabelCaps)}
        style={active ? railLabelActiveStyle : done ? railLabelDoneStyle : railLabelFutureStyle}
      >
        {label}
      </span>
    </TrackStep>
  )
}

/** The phone's step line over the notch track: `STEP 2 OF 9 · CLASS & ABILITY`. */
const railLineStyle = { color: tokens.color.ink, margin: 0 } satisfies CSSProperties
const railLineCaps = capsLabel({ size: 'caption', tracking: 'snug' })

/** Shown from lg (`.su-wiz-rail-pipe`). */
const pipeStyle = {
  backgroundColor: tokens.color.ink,
  // The pipe is a drawn shape, not a frame (ruleset §4.4's 3px is for frames).
  borderTopLeftRadius: '0.75rem', // design-tokens-ignore(raw-radius): the rail pipe's drawn end
  borderTopRightRadius: '0.75rem', // design-tokens-ignore(raw-radius): the rail pipe's drawn end
  bottom: tokens.space[48],
  left: tokens.space[4],
  position: 'absolute',
  top: tokens.space[4],
  width: tokens.space[28],
} satisfies CSSProperties satisfies CSSProperties

/** Shown from lg (`.su-wiz-rail-stub`). */
const pipeStubStyle = {
  backgroundColor: tokens.color.ink,
  borderBottomLeftRadius: '0.5rem', // design-tokens-ignore(raw-radius): the rail pipe's drawn end
  borderBottomRightRadius: '0.5rem', // design-tokens-ignore(raw-radius): the rail pipe's drawn end
  bottom: tokens.space[12],
  height: '2.25rem',
  justifyContent: 'center',
  left: tokens.space[4],
  position: 'absolute',
  width: tokens.space[28],
} satisfies CSSProperties satisfies CSSProperties

/** A CSS triangle: its borders are the arrowhead's geometry, not a frame weight. */
const arrowheadStyle = {
  borderLeft: '9px solid transparent', // design-tokens-ignore(raw-border-width): triangle geometry
  borderRight: '9px solid transparent', // design-tokens-ignore(raw-border-width): triangle geometry
  borderTop: `14px solid ${tokens.color.paper}`, // design-tokens-ignore(raw-border-width): triangle geometry
  height: 0,
  marginTop: tokens.space[8],
  width: 0,
} satisfies CSSProperties

/**
 * The wizard's stepper rail: the manual's connector pipe down a 196px column
 * from lg (a thick ink pipe, arrow-capped, behind the step tabs), a row of
 * number tabs above the pane under it (labels from md), and on a phone one
 * step line over a track of notches. A step already passed goes back to it.
 */
export function WizRail({
  steps,
  active,
  reached,
  onStepClick,
}: {
  steps: readonly string[]
  active: number
  reached: number
  /** With it, a step already passed is a way back to it. */
  onStepClick: ((index: number) => void) | undefined
}) {
  return (
    <aside className="su-wiz-rail" data-print="hide">
      {/* A phone's rail is one line and a track of notches; the h1 reads
          the same count to a screen reader. */}
      <p aria-hidden="true" className={cn('su-wiz-rail-line', railLineCaps)} style={railLineStyle}>
        {buildWizardCopy('stepOf', { value: active + 1, count: steps.length })} {steps[active]}
      </p>
      <nav aria-label={buildWizardCopy('steps')} className="su-wiz-rail-nav">
        {/* The pipe — thick, runs behind the tabs (lg only). */}
        <span aria-hidden="true" className="su-wiz-rail-pipe" style={pipeStyle} />
        {steps.map((label, i) => (
          <RailStep
            key={label}
            label={label}
            index={i}
            active={i === active}
            done={i < active}
            clickable={!!onStepClick && i !== active && i <= reached}
            onClick={onStepClick ? () => onStepClick(i) : undefined}
          />
        ))}
        {/* Black stub at the pipe's end with a chunky white arrowhead. */}
        <span aria-hidden="true" className="su-wiz-rail-stub" style={pipeStubStyle}>
          <span style={arrowheadStyle} />
        </span>
      </nav>
    </aside>
  )
}
