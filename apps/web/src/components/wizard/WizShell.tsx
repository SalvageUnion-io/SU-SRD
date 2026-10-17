import type { SheetKind } from 'cantina-domain/entityKinds'
import type { CSSProperties, ReactNode } from 'react'
import { useState } from 'react'
import { Button, ChapterBand, ConfirmDialog, tokens } from '../index'
import '../../styles/cantina/wizard.css'

/** Sheet tone context — picks the `.su-sheet--{kind}` poster theming. */
type WizKind = SheetKind

type WizShellProps = {
  /** Sheet tone context (`.su-sheet--{kind}`) — themes ground, band, and rail. */
  kind: WizKind
  /** Poster band banner, e.g. 'New Pilot' / 'Edit Pilot'. */
  eyebrow: string
  /** Ordered step labels — also drives the primary CTA ('Next · {label} →'). */
  steps: readonly string[]
  /** Index of the active step. */
  active: number
  /** When provided, completed stepper entries navigate back. */
  onStepClick?: (index: number) => void
  /** Step heading — the step card's title, read as 'Step n of N · {title}'. */
  title: string
  /** Main pane content (detail card, Sel grid, form, review). */
  children: ReactNode
  /**
   * Black tracker tabs hosted in the action pill — live budget/count chrome.
   * Pass `WizTracker` elements.
   */
  trackers?: ReactNode
  /**
   * One-line step status shown inside the sticky action pill, beside the
   * buttons — the single home for budget-cap notices like 'Max Abilities
   * selected (3 / 3)'.
   */
  footerNote?: ReactNode
  /**
   * Escape hatch shown inside the action pill: a link/button to abandon the
   * guided guardrails and finish the build off-rules on the Free-Edit Live
   * Sheet (ADR-021). Rendered subordinate to the CTA; omit to hide.
   */
  escapeAction?: ReactNode
  onBack?: () => void
  onCancel: () => void
  /**
   * When true (a dirty form), Cancel asks for confirmation before
   * discarding, so a mis-tap cannot destroy a multi-step build. Default false keeps pristine forms one-click.
   */
  confirmCancel?: boolean
  /** Advances to the next step, or submits on the last step. */
  onNext: () => void
  nextDisabled?: boolean
  /** Disables all footer actions while a submit is in flight. */
  busy?: boolean
  /** Final-step CTA label, e.g. 'Create Pilot ✦' / 'Save Pilot'. */
  submitLabel: string
}

const trackerStyle = {
  alignItems: 'baseline',
  backgroundColor: tokens.color.ink,
  borderRadius: tokens.radius.badge,
  boxShadow: 'inset 0 0 0 1.5px var(--color-paper-30)',
  color: tokens.color.paper,
  display: 'inline-flex',
  fontFamily: tokens.font.cond,
  fontSize: tokens.fontSize.caption,
  fontWeight: tokens.weight.bold,
  gap: tokens.space[8],
  letterSpacing: tokens.tracking.caps,
  lineHeight: 1,
  padding: `0.375rem ${tokens.space[12]}`,
  textTransform: 'uppercase',
  whiteSpace: 'nowrap',
} satisfies CSSProperties

const trackerValueStyle = {
  color: tokens.color.pilot,
  fontSize: tokens.fontSize.lede,
  letterSpacing: tokens.tracking.capsTight,
} satisfies CSSProperties

/**
 * Black tracker tab: condensed-caps label
 * with an amber value, hosted in the WizShell action pill. Its value is the
 * caller's: the tab does no budget math.
 */
export function WizTracker({ label, value }: { label: string; value: ReactNode }) {
  return (
    <span style={trackerStyle}>
      <span>{label}</span>
      <span style={trackerValueStyle}>{value}</span>
    </span>
  )
}

/** Its vertical margin opens at lg, and a disabled tab ignores the pointer
 *  (`.su-wiz-rail-step`). */
const railStepStyle = {
  alignItems: 'center',
  display: 'flex',
  gap: tokens.space[10],
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

/** Its lg pull-left is `.su-wiz-rail-tab--active`. */
const railTabActiveStyle = {
  ...railTabStyle,
  backgroundColor: tokens.color.ink,
  boxShadow: '0 0 0 4px var(--tone)',
  color: tokens.color.paper,
  fontSize: tokens.fontSize['2xl'],
  height: '2.75rem',
  lineHeight: 1,
  width: '2.75rem',
} satisfies CSSProperties satisfies CSSProperties

const railTabDoneStyle = {
  ...railTabStyle,
  backgroundColor: tokens.color.ink,
  color: tokens.color.pilot,
  fontSize: tokens.fontSize.readout,
  height: '34px',
  width: '34px',
} satisfies CSSProperties

const railTabFutureStyle = {
  ...railTabStyle,
  backgroundColor: tokens.color.paper,
  boxShadow: 'inset 0 0 0 2.5px var(--color-ink)',
  color: tokens.color.ink,
  fontSize: tokens.fontSize.readout,
  height: '34px',
  width: '34px',
} satisfies CSSProperties

/**
 * Hidden until 721px (`.su-wiz-rail-label`). No lineHeight: the label inherits
 * its line height, and that is the rendered look. Don't add one.
 */
const railLabelStyle = {
  color: tokens.color.ink,
  fontFamily: tokens.font.cond,
  fontWeight: tokens.weight.bold,
  letterSpacing: tokens.tracking.capsSnug,
  textTransform: 'uppercase',
} satisfies CSSProperties

const railLabelActiveStyle = {
  ...railLabelStyle,
  fontSize: tokens.fontSize.caption,
} satisfies CSSProperties

const railLabelDoneStyle = {
  ...railLabelStyle,
  fontSize: tokens.fontSize.note,
  opacity: 0.8,
} satisfies CSSProperties

const railLabelFutureStyle = {
  ...railLabelStyle,
  fontSize: tokens.fontSize.note,
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
    <button
      type="button"
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
        className={active ? 'su-wiz-rail-tab--active' : undefined}
        style={active ? railTabActiveStyle : done ? railTabDoneStyle : railTabFutureStyle}
      >
        {done ? '✓' : index + 1}
      </span>
      <span
        className="su-wiz-rail-label"
        style={active ? railLabelActiveStyle : done ? railLabelDoneStyle : railLabelFutureStyle}
      >
        {label}
      </span>
    </button>
  )
}

/** Its direction, alignment, gap and padding change at sm (`.su-wiz-pill`). */
const pillStyle = {
  backgroundColor: tokens.color.ink,
  display: 'flex',
  pointerEvents: 'auto',
} satisfies CSSProperties satisfies CSSProperties

/** Centred on a phone, start-aligned from sm (`.su-wiz-pill-start`). */
const pillTrackersStyle = {
  alignItems: 'center',
  display: 'flex',
  flexWrap: 'wrap',
  gap: tokens.space[8],
} satisfies CSSProperties satisfies CSSProperties

/** Centred on a phone, left-aligned from sm (`.su-wiz-pill-note`). */
const pillNoteStyle = {
  color: tokens.color.pilot,
  fontFamily: tokens.font.cond,
  fontSize: tokens.fontSize.xs,
  fontWeight: tokens.weight.semibold,
  letterSpacing: tokens.tracking.caps,
  lineHeight: 'calc(1 / 0.75)',
  margin: 0,
  paddingInline: tokens.space[8],
  textTransform: 'uppercase',
} satisfies CSSProperties satisfies CSSProperties

const pillEscapeStyle = { display: 'flex', paddingInline: tokens.space[8] } satisfies CSSProperties

/** A row on a phone, `display: contents` from sm (`.su-wiz-pill-nav`). */
const pillNavStyle = {
  alignItems: 'center',
  gap: tokens.space[8],
  justifyContent: 'flex-end',
} satisfies CSSProperties satisfies CSSProperties

/** Full width on a phone, its own width from sm (`.su-wiz-pill-cta`). */
const ctaStyle = { borderRadius: tokens.radius.card } satisfies CSSProperties

/** Locked: hollow, dashed, at full opacity though disabled. */
const ctaLockedStyle = {
  ...ctaStyle,
  backgroundColor: 'transparent',
  borderColor: 'color-mix(in oklab, var(--color-paper) 55%, transparent)',
  borderStyle: 'dashed',
  borderWidth: '2px',
  boxShadow: 'none',
  color: tokens.color.paper60,
  fontWeight: tokens.weight.normal,
  opacity: 1,
} satisfies CSSProperties

const shellStyle = {
  display: 'flex',
  flexDirection: 'column',
  minHeight: '100dvh',
} satisfies CSSProperties

/** A column on a phone, a row from lg (`.su-wiz-body`). */
const bodyStyle = { display: 'flex', flex: '1 1 0%' } satisfies CSSProperties

/** Shown from lg (`.su-wiz-rail-pipe`). */
const pipeStyle = {
  backgroundColor: tokens.color.ink,
  borderTopLeftRadius: '0.75rem',
  borderTopRightRadius: '0.75rem',
  bottom: tokens.space[48],
  left: tokens.space[4],
  position: 'absolute',
  top: tokens.space[4],
  width: tokens.space[28],
} satisfies CSSProperties satisfies CSSProperties

/** Shown from lg (`.su-wiz-rail-stub`). */
const pipeStubStyle = {
  backgroundColor: tokens.color.ink,
  borderBottomLeftRadius: '0.5rem',
  borderBottomRightRadius: '0.5rem',
  bottom: tokens.space[12],
  height: '2.25rem',
  justifyContent: 'center',
  left: tokens.space[4],
  position: 'absolute',
  width: tokens.space[28],
} satisfies CSSProperties satisfies CSSProperties

const arrowheadStyle = {
  borderLeft: '9px solid transparent',
  borderRight: '9px solid transparent',
  borderTop: `14px solid ${tokens.color.paper}`,
  height: 0,
  marginTop: tokens.space[10],
  width: 0,
} satisfies CSSProperties

/** Its padding grows at lg (`.su-wiz-main`). */
const mainStyle = {
  display: 'flex',
  flex: '1 1 0%',
  flexDirection: 'column',
  minWidth: 0,
} satisfies CSSProperties satisfies CSSProperties

const fillStyle = { flex: '1 1 0%', minHeight: 0 } satisfies CSSProperties

/** Its left padding — the number tab's gutter — opens at sm (`.su-wiz-step-card`). */
const stepCardStyle = {
  borderRadius: tokens.radius.card,
  paddingBottom: tokens.space[24],
  paddingRight: tokens.space[20],
  paddingTop: tokens.space[20],
  position: 'relative',
} satisfies CSSProperties satisfies CSSProperties

/** Shown from sm (`.su-wiz-step-tab`). */
const stepTabStyle = {
  backgroundColor: tokens.color.ink,
  borderRadius: tokens.radius.badge,
  color: tokens.color.paper,
  fontFamily: tokens.font.cond,
  fontSize: tokens.fontSize.hero,
  fontWeight: tokens.weight.extrabold,
  height: tokens.space[64],
  left: `-${tokens.space[20]}`,
  lineHeight: 1,
  placeItems: 'center',
  position: 'absolute',
  top: tokens.space[24],
  width: '3.5rem',
} satisfies CSSProperties satisfies CSSProperties

const stepCardTitleStyle = {
  color: 'currentcolor',
  fontFamily: tokens.font.cond,
  fontSize: tokens.fontSize.display,
  fontWeight: tokens.weight.bold,
  lineHeight: 1.05,
  margin: 0,
  textTransform: 'uppercase',
} satisfies CSSProperties

const stepCardBodyStyle = { marginTop: tokens.space[16] } satisfies CSSProperties

const footerPillStyle = {
  bottom: tokens.space[16],
  display: 'flex',
  justifyContent: 'flex-end',
  marginTop: tokens.space[24],
  pointerEvents: 'none',
  position: 'sticky',
  zIndex: 40,
} satisfies CSSProperties

/**
 * Shared wizard skeleton, a poster sibling: the `.su-sheet--{kind}` tone context
 * on the `var(--ground)` page, a tone band banner up top, the manual's
 * connector-pipe stepper rail (196px) and a flex-1 main pane holding the
 * tinted step card, with a floating ink action pill (ghost Back/Cancel +
 * primary CTA + tracker tabs + gate text).
 * The shell is layout-only — all wizard state lives in the caller.
 *
 * Mobile (≤lg) stacks the panes full-width with a horizontal tab rail
 * (labels hidden ≤720px).
 */
export function WizShell({
  kind,
  eyebrow,
  steps,
  active,
  onStepClick,
  title,
  children,
  trackers,
  footerNote,
  escapeAction,
  onBack,
  onCancel,
  onNext,
  nextDisabled = false,
  busy = false,
  submitLabel,
  confirmCancel = false,
}: WizShellProps) {
  const [confirmingCancel, setConfirmingCancel] = useState(false)
  const isLast = active >= steps.length - 1
  const ctaLabel = isLast ? submitLabel : `Next · ${steps[active + 1]} →`
  // The ink action pill: trackers + gate note + escape + nav buttons + CTA.
  // Its own dark ground keeps the ghost buttons legible.
  const actionPill = (
    <div className="su-wiz-pill" style={pillStyle}>
      {trackers && (
        <div className="su-wiz-pill-start" style={pillTrackersStyle}>
          {trackers}
        </div>
      )}
      {footerNote && (
        <p role="status" className="su-wiz-pill-note" style={pillNoteStyle}>
          {footerNote}
        </p>
      )}
      {escapeAction && (
        <div className="su-wiz-pill-start" style={pillEscapeStyle}>
          {escapeAction}
        </div>
      )}
      {/* Ghost nav row on phones; dissolves into the pill row ≥ sm. */}
      <div className="su-wiz-pill-nav" style={pillNavStyle}>
        {onBack && (
          <Button variant="ghost" onClick={onBack} disabled={busy} className="su-wiz-pill-ghost">
            Back
          </Button>
        )}
        <Button
          variant="ghost"
          onClick={() => (confirmCancel ? setConfirmingCancel(true) : onCancel())}
          disabled={busy}
          className="su-wiz-pill-ghost"
        >
          Cancel
        </Button>
        <ConfirmDialog
          open={confirmingCancel}
          onOpenChange={setConfirmingCancel}
          title="Discard this draft?"
          tone="danger"
          body="Your unsaved changes will be lost."
          confirmLabel="Discard"
          cancelLabel="Keep editing"
          onConfirm={onCancel}
        />
      </div>
      {/* Locked CTA: hollow, dashed, dimmed weight —
          the blocking reason lives in the footerNote text. */}
      <Button
        variant="primary"
        size="full"
        className="su-wiz-pill-cta"
        style={nextDisabled && !busy ? ctaLockedStyle : ctaStyle}
        onClick={onNext}
        disabled={nextDisabled || busy}
      >
        {busy ? 'Saving…' : ctaLabel}
      </Button>
    </div>
  )

  return (
    <div className={`su-sheet--${kind}`} style={shellStyle}>
      {/* The page title as every other page sets it. A paragraph: the step
          card's title is the page's h1. */}
      <ChapterBand tone={kind} as="p">
        {eyebrow}
      </ChapterBand>

      <div className="su-wiz-body" style={bodyStyle}>
        {/* (a) 196px connector-pipe stepper rail: a thick ink
            pipe with an arrow-capped end runs behind the step tabs on lg;
            mobile keeps the horizontal wrap without the pipe. */}
        <aside className="su-wiz-rail">
          <nav aria-label="Steps" className="su-wiz-rail-nav">
            {/* The pipe — thick, runs behind the tabs (lg only). */}
            <span aria-hidden="true" className="su-wiz-rail-pipe" style={pipeStyle} />
            {steps.map((label, i) => (
              <RailStep
                key={label}
                label={label}
                index={i}
                active={i === active}
                done={i < active}
                clickable={!!onStepClick && !busy && i < active}
                onClick={onStepClick ? () => onStepClick(i) : undefined}
              />
            ))}
            {/* Black stub at the pipe's end with a chunky white arrowhead. */}
            <span aria-hidden="true" className="su-wiz-rail-stub" style={pipeStubStyle}>
              <span style={arrowheadStyle} />
            </span>
          </nav>
        </aside>

        {/* (b) flex-1 main pane — always owns the step heading */}
        <main className="su-wiz-main" style={mainStyle}>
          {/* Tinted step card: tone-card fill, flush ink number tab, condensed
              step head in the card ink. */}
          {/* The sticky footer overlaps content when pinned, so the frame
              reserves scroll room beneath it. */}
          <div className="su-wiz-step-frame" style={{ ...fillStyle, paddingBottom: '6rem' }}>
            <article
              className="su-wiz-step-card"
              style={{
                ...stepCardStyle,
                background: 'var(--tone-card, var(--tone))',
                // Card ink, ONE rule for all three sheets: every step card is
                // a light tint derived from its page tone, so all of them
                // take dark ink (6.8–9.7:1). Content sitting directly on the
                // card — the step head included — inherits it.
                color: 'var(--tone-card-ink, var(--color-ink))',
              }}
            >
              <span aria-hidden="true" className="su-wiz-step-tab" style={stepTabStyle}>
                {active + 1}
              </span>
              <header>
                {/* The title INHERITS `--tone-card-ink` from the article
                      (`currentcolor`) instead of hardcoding paper: on these
                      light tints a white title measures 1.54:1 on the pilot
                      fill and 1.91 / 2.18 on mech and crawler — invisible.
                      Inheriting keeps the title and the body copy on the same
                      ink rule, so a future dark card flips both together. */}
                <h1 style={stepCardTitleStyle}>
                  <span className="su-sr-only">
                    Step {active + 1} of {steps.length} ·{' '}
                  </span>
                  {title}
                </h1>
              </header>
              <div style={stepCardBodyStyle}>{children}</div>
            </article>
          </div>

          {/* Footer — floats sticky at the bottom-right of the viewport as the
              content scrolls, so confirm/nav stays reachable without a
              full-width bar eating vertical space. The footer itself is
              click-through (`pointer-events: none`); only the ink action pill
              is interactive. Below the sm endpoint the pill stacks with a
              full-width primary CTA on EVERY step — Back/Cancel share a row
              above it. */}
          <footer style={footerPillStyle}>{actionPill}</footer>
        </main>
      </div>
    </div>
  )
}
