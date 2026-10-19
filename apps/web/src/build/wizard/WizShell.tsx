import type { SheetKind } from 'game-domain/entityKinds'
import type { CSSProperties, ReactNode } from 'react'
import { useState } from 'react'
import { Box } from '../../components/containers/Box'
import { Badge, Button, ChapterBand, ConfirmDialog, tokens } from '../../components/index'
import '../../styles/build/wizard.css'

/**
 * Sheet tone context — picks the `.su-sheet--{kind}` poster theming. The NPC
 * designer is a wizard too (hard rule R16: every wizard is WizShell).
 */
type WizKind = SheetKind | 'npc'

type WizShellProps = {
  /** Sheet tone context (`.su-sheet--{kind}`) — themes ground, band, and rail. */
  kind: WizKind
  /** Poster band banner, e.g. 'New Pilot' / 'Edit Pilot'. */
  eyebrow: string
  /**
   * Draw the poster band. False when the page around the wizard draws its own
   * (the NPC designer's, which carries its Any NPC | Crawler crew tabs).
   */
  band?: boolean
  /** Ordered step labels — also drives the primary CTA ('Next · {label} →'). */
  steps: readonly string[]
  /** Index of the active step. */
  active: number
  /** When provided, completed stepper entries navigate back. */
  onStepClick?: (index: number) => void
  /** Step heading — the page's h1 over the step's content, read as 'Step n of N · {title}'. */
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
  padding: `${tokens.space[6]} ${tokens.space[12]}`,
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
  height: tokens.size.full,
  lineHeight: 1,
  width: tokens.size.full,
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

/** Locked: hollow, at full opacity though disabled. */
const ctaLockedStyle = {
  ...ctaStyle,
  backgroundColor: 'transparent',
  borderColor: tokens.color.paper60,
  borderStyle: 'solid',
  borderWidth: tokens.borderWidth.pill,
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

/** Under a page's own band: the shell's column, as tall as its content. */
const shellUnderBandStyle = { display: 'flex', flexDirection: 'column' } satisfies CSSProperties

/** A column on a phone, a row from lg (`.su-wiz-body`). */
const bodyStyle = { display: 'flex', flex: '1 1 0%' } satisfies CSSProperties

/** Shown from lg (`.su-wiz-rail-pipe`). */
const pipeStyle = {
  backgroundColor: tokens.color.ink,
  // The pipe is a drawn shape, not a frame (ruleset §4.4's 3px is for frames).
  borderTopLeftRadius: '0.75rem', // design-tokens-ignore: the rail pipe's drawn end
  borderTopRightRadius: '0.75rem', // design-tokens-ignore: the rail pipe's drawn end
  bottom: tokens.space[48],
  left: tokens.space[4],
  position: 'absolute',
  top: tokens.space[4],
  width: tokens.space[28],
} satisfies CSSProperties satisfies CSSProperties

/** Shown from lg (`.su-wiz-rail-stub`). */
const pipeStubStyle = {
  backgroundColor: tokens.color.ink,
  borderBottomLeftRadius: '0.5rem', // design-tokens-ignore: the rail pipe's drawn end
  borderBottomRightRadius: '0.5rem', // design-tokens-ignore: the rail pipe's drawn end
  bottom: tokens.space[12],
  height: '2.25rem',
  justifyContent: 'center',
  left: tokens.space[4],
  position: 'absolute',
  width: tokens.space[28],
} satisfies CSSProperties satisfies CSSProperties

/** A CSS triangle: its borders are the arrowhead's geometry, not a frame weight. */
const arrowheadStyle = {
  borderLeft: '9px solid transparent', // design-tokens-ignore: triangle geometry
  borderRight: '9px solid transparent', // design-tokens-ignore: triangle geometry
  borderTop: `14px solid ${tokens.color.paper}`, // design-tokens-ignore: triangle geometry
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

/** The step's frame: it reserves scroll room under the pinned footer, which overlaps it. */
const stepFrameStyle = {
  ...fillStyle,
  paddingBottom: '6rem', // design-tokens-ignore: a fit, the pinned footer's room, not spacing
} satisfies CSSProperties

/** The step's head: its number stamp and its title on one line, over the frame. */
const stepHeadStyle = {
  alignItems: 'baseline',
  display: 'flex',
  gap: tokens.space[10],
  marginBottom: tokens.space[12],
} satisfies CSSProperties

/** The step's number: the ink Stamp (ruleset §5.1), at the title's size. */
const stepNumberStyle = {
  flex: 'none',
  fontSize: tokens.fontSize.title,
  fontWeight: tokens.weight.extrabold,
  lineHeight: 1.05,
  padding: `${tokens.space[4]} ${tokens.space[8]} ${tokens.space[2]}`,
} satisfies CSSProperties

/** The title, in `.su-entity-row__title`'s face. */
const stepTitleStyle = {
  fontFamily: tokens.font.cond,
  fontSize: tokens.fontSize.title,
  fontWeight: tokens.weight.extrabold,
  letterSpacing: tokens.tracking.capsTight,
  lineHeight: 1.05,
  textTransform: 'uppercase',
  color: tokens.color.ink,
  margin: 0,
  minWidth: 0,
  overflowWrap: 'break-word',
} satisfies CSSProperties

/** The step's paper body, a plain block (not the box's flex column): 20px in. */
const stepBodyStyle = { padding: tokens.space[20] } satisfies CSSProperties

const footerPillStyle = {
  bottom: tokens.space[16],
  display: 'flex',
  justifyContent: 'flex-end',
  marginTop: tokens.space[24],
  pointerEvents: 'none',
  position: 'sticky',
  zIndex: tokens.layer.sticky,
} satisfies CSSProperties

/**
 * Shared wizard skeleton, a poster sibling: the `.su-sheet--{kind}` tone context
 * on the `var(--ground)` page, a tone band banner up top, the manual's
 * connector-pipe stepper rail (196px) and a flex-1 main pane holding the
 * step: its number stamp and h1 title over an untitled frame of its content
 * (ruleset N6: a container that holds entities is untitled, so the entities
 * in the step are the titled things), with a floating ink action pill (ghost
 * Back/Cancel + primary CTA + tracker tabs + gate text).
 * The shell is layout-only — all wizard state lives in the caller.
 *
 * Mobile (≤lg) stacks the panes full-width with a horizontal tab rail
 * (labels hidden ≤720px).
 */
export function WizShell({
  kind,
  eyebrow,
  band = true,
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
  // It declares its ink ground (chrome K1), so its ghost buttons read paper.
  const actionPill = (
    <div className="su-wiz-pill" data-ground="ink" style={pillStyle}>
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
          <Button variant="ghost" onClick={onBack} disabled={busy}>
            Back
          </Button>
        )}
        <Button
          variant="ghost"
          onClick={() => (confirmCancel ? setConfirmingCancel(true) : onCancel())}
          disabled={busy}
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
      {/* Locked CTA: hollow, dimmed weight —
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
    <div className={`su-sheet--${kind}`} style={band ? shellStyle : shellUnderBandStyle}>
      {/* The page title as every other page sets it. A paragraph: the step's
          title is the page's h1. */}
      {band && (
        <ChapterBand tone={kind === 'npc' ? 'denizen' : kind} as="p">
          {eyebrow}
        </ChapterBand>
      )}

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

        {/* (b) flex-1 main pane — always owns the step heading. A plain
            block: the route wraps the wizard in the page's one <main>. */}
        <div className="su-wiz-main" style={mainStyle}>
          {/* The step (N6): its number stamp and h1 over an untitled frame,
              with no band, so the entities in it are the titled things. */}
          <div className="su-wiz-step-frame" style={stepFrameStyle}>
            <article>
              <div style={stepHeadStyle}>
                <Badge shape="stamp" size="full" aria-hidden="true" style={stepNumberStyle}>
                  {active + 1}
                </Badge>
                <h1 style={stepTitleStyle}>
                  <span className="su-sr-only">
                    Step {active + 1} of {steps.length} ·{' '}
                  </span>
                  {title}
                </h1>
              </div>
              <Box body="flush">
                <div style={stepBodyStyle}>{children}</div>
              </Box>
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
        </div>
      </div>
    </div>
  )
}
