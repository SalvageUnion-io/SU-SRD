import { Button, ModalShell, tokens } from 'component-lib'
import type { CSSProperties, ReactNode } from 'react'
import { useState } from 'react'
import '../../styles/wizard.css'
import { dialogActionsStyle, dialogBodyStyle, dialogNoteStyle } from './wizardStyles.model'

/** Sheet tone context — picks the `.sheet--{kind}` poster theming. */
export type WizKind = 'pilot' | 'mech' | 'crawler'

type WizShellProps = {
  /** Sheet tone context (`.sheet--{kind}`) — themes ground, band, and rail. */
  kind: WizKind
  /** Poster band banner, e.g. 'New Pilot' / 'Edit Pilot'. */
  eyebrow: string
  /** Ordered step labels — also drives the primary CTA ('Next · {label} →'). */
  steps: readonly string[]
  /** Index of the active step. */
  active: number
  /** When provided, completed stepper entries navigate back. */
  onStepClick?: (index: number) => void
  /** Step heading — stamped as 'STEP n OF N · {title}' in the main pane. */
  title: string
  /** Meta line under the title — live counts, helper copy. */
  subtitle?: ReactNode
  /** Main pane content (detail card, Sel grid, form, review). */
  children: ReactNode
  /** Rendered between content and footer — soft warnings, submit errors. */
  notice?: ReactNode
  /**
   * Black tracker tabs hosted in the action pill (mockup `.trackrow` idiom
   * promoted into the footer slot) — live budget/count chrome. Pass
   * `WizTracker` elements.
   */
  trackers?: ReactNode
  /**
   * One-line step status shown inside the sticky action pill, beside the
   * buttons — the single home for budget-cap notices like 'Max Abilities
   * selected (3 / 3)'.
   */
  footerNote?: ReactNode
  /**
   * Rich, step-specific HUD content mounted INTO the floating footer bar
   * alongside the nav pill (the mech install steps pass their Loadout HUD —
   * gauges + installed chips — here). When present the footer becomes a wide
   * paper bar holding the HUD with the ink action pill nested at its right; when
   * absent the footer stays the compact ink pill. Distinct from `trackers`
   * (small black tabs inside the pill) — this is a full-width content region.
   */
  footerHud?: ReactNode
  /**
   * Escape hatch shown inside the action pill: a link/button to abandon the
   * guided guardrails and finish the build off-rules on the Free-Edit Live
   * Sheet (ADR-021). Rendered subordinate to the CTA; omit to hide.
   */
  escapeAction?: ReactNode
  /**
   * OPT-IN blown-up tinted step card (mockup Screen 01 `.stepcard`): the main
   * pane renders the heading + content inside a `var(--tone-card)` card with
   * a flush ink number tab. Only book-order wizards should opt in (pilot as
   * of Phase 3); the still-multi-section Mech/Crawler wizards stay untinted
   * until their phases.
   */
  tintedStepCard?: boolean
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

const trackerStyle: CSSProperties = {
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
}

const trackerValueStyle: CSSProperties = {
  color: tokens.color.pilot,
  fontSize: tokens.fontSize.lede,
  letterSpacing: tokens.tracking.capsTight,
}

/**
 * Black tracker tab (mockup `.tracker`): condensed-caps label
 * with an amber value, hosted in the WizShell action pill. Phase 2 chrome —
 * values reflect today's wizard state; real budget math lands in Phases 3–5.
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
 *  (`.wiz-rail-step`). */
const railStepStyle: CSSProperties = {
  alignItems: 'center',
  display: 'flex',
  gap: tokens.space[10],
  position: 'relative',
  textAlign: 'left',
  zIndex: 1,
}

const railStepClickableStyle: CSSProperties = { ...railStepStyle, cursor: 'pointer' }

const railTabStyle: CSSProperties = {
  borderRadius: tokens.radius.badge,
  display: 'grid',
  flexShrink: 0,
  fontFamily: tokens.font.cond,
  fontWeight: tokens.weight.bold,
  placeItems: 'center',
}

/** Its lg pull-left is `.wiz-rail-tab--active`. */
const railTabActiveStyle: CSSProperties = {
  ...railTabStyle,
  backgroundColor: tokens.color.ink,
  boxShadow: '0 0 0 4px var(--tone)',
  color: tokens.color.paper,
  fontSize: tokens.fontSize['2xl'],
  height: '2.75rem',
  lineHeight: 1,
  width: '2.75rem',
}

const railTabDoneStyle: CSSProperties = {
  ...railTabStyle,
  backgroundColor: tokens.color.ink,
  color: tokens.color.pilot,
  fontSize: tokens.fontSize.readout,
  height: '34px',
  width: '34px',
}

const railTabFutureStyle: CSSProperties = {
  ...railTabStyle,
  backgroundColor: tokens.color.paper,
  boxShadow: 'inset 0 0 0 2.5px var(--color-ink)',
  color: tokens.color.ink,
  fontSize: tokens.fontSize.readout,
  height: '34px',
  width: '34px',
}

/**
 * Hidden until 721px (`.wiz-rail-label`). No line height of its own: the
 * utility version asked for 1.15, but the old `cn()` class merge dropped it in
 * favour of the size class that followed, so the label has always inherited.
 */
const railLabelStyle: CSSProperties = {
  color: tokens.color.ink,
  fontFamily: tokens.font.cond,
  fontWeight: tokens.weight.bold,
  letterSpacing: tokens.tracking.capsSnug,
  textTransform: 'uppercase',
}

const railLabelActiveStyle: CSSProperties = { ...railLabelStyle, fontSize: tokens.fontSize.caption }

const railLabelDoneStyle: CSSProperties = {
  ...railLabelStyle,
  fontSize: tokens.fontSize.note,
  opacity: 0.8,
}

const railLabelFutureStyle: CSSProperties = {
  ...railLabelStyle,
  fontSize: tokens.fontSize.note,
  opacity: 0.66,
}

/** Connector-pipe rail entry (mockup `.rstep`/`.rtab`) — one step tab + label. */
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
      className="wiz-rail-step"
      style={clickable ? railStepClickableStyle : railStepStyle}
    >
      {/* Sharp ink number tab: done = amber check, active = enlarged + tone
          ring, future = hollow ink-outlined block (never opacity-faded). */}
      <span
        aria-hidden="true"
        className={active ? 'wiz-rail-tab--active' : undefined}
        style={active ? railTabActiveStyle : done ? railTabDoneStyle : railTabFutureStyle}
      >
        {done ? '✓' : index + 1}
      </span>
      <span
        className="wiz-rail-label"
        style={active ? railLabelActiveStyle : done ? railLabelDoneStyle : railLabelFutureStyle}
      >
        {label}
      </span>
    </button>
  )
}

const headingStyle: CSSProperties = { margin: 0 }

const stepStampStyle: CSSProperties = {
  backgroundColor: tokens.color.ink,
  boxDecorationBreak: 'clone',
  color: tokens.color.paper,
  display: 'inline',
  fontFamily: tokens.font.cond,
  fontSize: tokens.fontSize.title,
  fontWeight: tokens.weight.bold,
  letterSpacing: '0em',
  lineHeight: 1.35,
  padding: `2px ${tokens.space[8]} 3px`,
  textTransform: 'uppercase',
  WebkitBoxDecorationBreak: 'clone',
}

const stepCountStyle: CSSProperties = { color: tokens.color.pilot }

const subtitleStyle: CSSProperties = {
  color: tokens.color.wkMuted,
  fontFamily: tokens.font.body,
  fontSize: tokens.fontSize.caption,
  marginTop: tokens.space[8],
}

/** Its direction, alignment, gap, radius and padding change at sm (`.wiz-pill`). */
const pillStyle: CSSProperties = {
  backgroundColor: tokens.color.ink,
  boxShadow: '0 16px 28px -12px var(--color-ink-50)',
  display: 'flex',
  pointerEvents: 'auto',
}

/** Centred on a phone, start-aligned from sm (`.wiz-pill-start`). */
const pillTrackersStyle: CSSProperties = {
  alignItems: 'center',
  display: 'flex',
  flexWrap: 'wrap',
  gap: tokens.space[8],
}

/** Centred on a phone, left-aligned from sm (`.wiz-pill-note`). */
const pillNoteStyle: CSSProperties = {
  color: tokens.color.pilot,
  fontFamily: tokens.font.cond,
  fontSize: tokens.fontSize.xs,
  fontWeight: tokens.weight.semibold,
  letterSpacing: tokens.tracking.caps,
  lineHeight: 'calc(1 / 0.75)',
  margin: 0,
  paddingInline: tokens.space[8],
  textTransform: 'uppercase',
}

const pillEscapeStyle: CSSProperties = { display: 'flex', paddingInline: tokens.space[8] }

/** A row on a phone, `display: contents` from sm (`.wiz-pill-nav`). */
const pillNavStyle: CSSProperties = {
  alignItems: 'center',
  gap: tokens.space[8],
  justifyContent: 'flex-end',
}

/** Full width on a phone, its own width from sm (`.wiz-pill-cta`). */
const ctaStyle: CSSProperties = { borderRadius: tokens.radius.full }

/** Locked (mockup `.next.locked`): hollow, dashed, at full opacity though disabled. */
const ctaLockedStyle: CSSProperties = {
  ...ctaStyle,
  backgroundColor: 'transparent',
  borderColor: 'color-mix(in oklab, var(--color-paper) 55%, transparent)',
  borderStyle: 'dashed',
  borderWidth: '2px',
  boxShadow: 'none',
  color: tokens.color.paper60,
  fontWeight: tokens.weight.normal,
  opacity: 1,
}

const shellStyle: CSSProperties = {
  background: 'var(--ground)',
  display: 'flex',
  flexDirection: 'column',
  minHeight: '100dvh',
}

/** Its inline padding widens at sm (`.wiz-band`). */
const bandStyle: CSSProperties = {
  background: 'var(--tone)',
  borderBottom: '4px solid color-mix(in oklab, var(--color-paper) 95%, transparent)',
  paddingBottom: tokens.space[10],
  paddingTop: tokens.space[20],
}

const bannerStyle: CSSProperties = {
  color: tokens.color.paper,
  fontFamily: tokens.font.cond,
  fontSize: 'clamp(26px, 4vw, 40px)',
  fontWeight: tokens.weight.bold,
  letterSpacing: '0em',
  lineHeight: 0.98,
  margin: 0,
  textShadow: '0 2px 0 var(--color-ink-20)',
  textTransform: 'uppercase',
}

const bandTailStyle: CSSProperties = {
  background: 'var(--tone)',
  flexShrink: 0,
  height: tokens.space[8],
}

/** A column on a phone, a row from lg (`.wiz-body`). */
const bodyStyle: CSSProperties = { display: 'flex', flex: '1 1 0%' }

/** Shown from lg (`.wiz-rail-pipe`). */
const pipeStyle: CSSProperties = {
  backgroundColor: tokens.color.ink,
  borderTopLeftRadius: '0.75rem',
  borderTopRightRadius: '0.75rem',
  bottom: tokens.space[48],
  left: tokens.space[4],
  position: 'absolute',
  top: tokens.space[4],
  width: tokens.space[28],
}

/** Shown from lg (`.wiz-rail-stub`). */
const pipeStubStyle: CSSProperties = {
  backgroundColor: tokens.color.ink,
  borderBottomLeftRadius: '0.5rem',
  borderBottomRightRadius: '0.5rem',
  bottom: tokens.space[12],
  height: '2.25rem',
  justifyContent: 'center',
  left: tokens.space[4],
  position: 'absolute',
  width: tokens.space[28],
}

const arrowheadStyle: CSSProperties = {
  borderLeft: '9px solid transparent',
  borderRight: '9px solid transparent',
  borderTop: `14px solid ${tokens.color.paper}`,
  height: 0,
  marginTop: tokens.space[10],
  width: 0,
}

/** Its padding grows at lg (`.wiz-main`). */
const mainStyle: CSSProperties = {
  display: 'flex',
  flex: '1 1 0%',
  flexDirection: 'column',
  minWidth: 0,
}

const fillStyle: CSSProperties = { flex: '1 1 0%', minHeight: 0 }

/** Its left padding — the number tab's gutter — opens at sm (`.wiz-step-card`). */
const stepCardStyle: CSSProperties = {
  borderRadius: '0.75rem',
  boxShadow: '0 14px 26px -14px var(--color-ink-40), inset 0 0 46px var(--color-ink-8)',
  paddingBottom: tokens.space[24],
  paddingRight: tokens.space[20],
  paddingTop: tokens.space[20],
  position: 'relative',
}

/** Shown from sm (`.wiz-step-tab`). */
const stepTabStyle: CSSProperties = {
  backgroundColor: tokens.color.ink,
  borderRadius: tokens.radius.badge,
  boxShadow: '0 8px 14px -8px var(--color-ink-50)',
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
}

const stepCardTitleStyle: CSSProperties = {
  color: 'currentcolor',
  fontFamily: tokens.font.cond,
  fontSize: tokens.fontSize.display,
  fontWeight: tokens.weight.bold,
  lineHeight: 1.05,
  margin: 0,
  textTransform: 'uppercase',
}

const stepCardBodyStyle: CSSProperties = { marginTop: tokens.space[16] }

const noticeStyle: CSSProperties = { marginTop: tokens.space[24] }

const footerPillStyle: CSSProperties = {
  bottom: tokens.space[16],
  display: 'flex',
  justifyContent: 'flex-end',
  marginTop: tokens.space[24],
  pointerEvents: 'none',
  position: 'sticky',
  zIndex: 40,
}

/** Centred on a phone, right-aligned from sm (`.wiz-footer--hud`). */
const footerStyle: CSSProperties = { ...footerPillStyle, justifyContent: undefined }

/** Its width, direction, gap and padding change at sm (`.wiz-hud`). */
const hudStyle: CSSProperties = {
  backgroundColor: tokens.color.paper,
  borderColor: tokens.color.ink,
  borderStyle: 'solid',
  borderWidth: tokens.borderWidth.chrome,
  borderRadius: '1rem',
  boxShadow: '0 16px 28px -12px var(--color-ink-50)',
  display: 'flex',
  pointerEvents: 'auto',
}

const hudContentStyle: CSSProperties = {
  alignItems: 'center',
  display: 'flex',
  flex: '1 1 0%',
  minWidth: 0,
}

/**
 * Shared wizard skeleton, reskinned as a poster sibling (mockup
 * Screens 01/02): the `.sheet--{kind}` tone context on the
 * `var(--ground)` page, a tone band banner up top, the manual's connector-pipe
 * stepper rail (196px) and a flex-1 main pane
 * headed by an ink-stamp 'STEP n OF N · {title}' h1 with a floating ink
 * action pill (ghost Back/Cancel + primary CTA + tracker tabs + gate text).
 * The shell is layout-only — all wizard state lives in the caller.
 *
 * Mobile (≤lg) stacks the panes full-width with a horizontal tab rail
 * (labels hidden ≤720px, per the mockup).
 */
export function WizShell({
  kind,
  eyebrow,
  steps,
  active,
  onStepClick,
  title,
  subtitle,
  children,
  notice,
  trackers,
  footerNote,
  footerHud,
  escapeAction,
  tintedStepCard = false,
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
  // The sticky footer overlaps content when pinned, so the main pane reserves
  // scroll room beneath it. A HUD footer is taller (a full paper bar, not the
  // compact pill), so it reserves proportionally more.
  const contentPad = footerHud ? '13rem' : '6rem'

  const heading = (
    <header>
      <h1 style={headingStyle}>
        {/* Ink-stamp step heading: paper text on an ink band that wraps per line. */}
        <span style={stepStampStyle}>
          <span style={stepCountStyle}>
            Step {active + 1} of {steps.length}
          </span>
          {' · '}
          <span>{title}</span>
        </span>
      </h1>
      {subtitle && <div style={subtitleStyle}>{subtitle}</div>}
    </header>
  )

  // The ink action pill (mockup `.pill`): trackers + gate note + escape + nav
  // buttons + CTA. Rendered standalone in the footer by default; with a
  // `footerHud` it is MOUNTED at the right of the wide paper footer bar. Its own
  // dark ground keeps the ghost buttons legible in either home.
  const actionPill = (
    <div className="wiz-pill" style={pillStyle}>
      {trackers && (
        <div className="wiz-pill-start" style={pillTrackersStyle}>
          {trackers}
        </div>
      )}
      {footerNote && (
        <p role="status" className="wiz-pill-note" style={pillNoteStyle}>
          {footerNote}
        </p>
      )}
      {escapeAction && (
        <div className="wiz-pill-start" style={pillEscapeStyle}>
          {escapeAction}
        </div>
      )}
      {/* Ghost nav row on phones; dissolves into the pill row ≥ sm. */}
      <div className="wiz-pill-nav" style={pillNavStyle}>
        {onBack && (
          <Button variant="ghost" onClick={onBack} disabled={busy} className="wiz-pill-ghost">
            Back
          </Button>
        )}
        <Button
          variant="ghost"
          onClick={() => (confirmCancel ? setConfirmingCancel(true) : onCancel())}
          disabled={busy}
          className="wiz-pill-ghost"
        >
          Cancel
        </Button>
        <ModalShell
          open={confirmingCancel}
          onOpenChange={(next) => {
            if (!next) setConfirmingCancel(false)
          }}
          title="Discard this draft?"
          tone="danger"
          maxWidth="wiz-modal-md"
        >
          <div style={dialogBodyStyle}>
            <div style={dialogNoteStyle}>Your unsaved changes will be lost.</div>
            <div style={dialogActionsStyle}>
              <Button variant="ghost" size="compact" onClick={() => setConfirmingCancel(false)}>
                Keep editing
              </Button>
              <Button
                variant="danger"
                size="compact"
                onClick={() => {
                  setConfirmingCancel(false)
                  onCancel()
                }}
              >
                Discard
              </Button>
            </div>
          </div>
        </ModalShell>
      </div>
      {/* Locked CTA (mockup `.next.locked`): hollow, dashed, dimmed weight —
          the blocking reason lives in the footerNote text. */}
      <Button
        variant="primary"
        size="full"
        className="wiz-pill-cta"
        style={nextDisabled && !busy ? ctaLockedStyle : ctaStyle}
        onClick={onNext}
        disabled={nextDisabled || busy}
      >
        {busy ? 'Saving…' : ctaLabel}
      </Button>
    </div>
  )

  return (
    <div className={`sheet--${kind}`} style={shellStyle}>
      {/* Poster band (mockup `.band`/`.banner`): tone ground, white condensed
          banner, a white rule then a thin tone bandtail below it. */}
      <header className="wiz-band" style={bandStyle}>
        <p style={bannerStyle}>{eyebrow}</p>
      </header>
      <div style={bandTailStyle} aria-hidden="true" />

      <div className="wiz-body" style={bodyStyle}>
        {/* (a) 196px connector-pipe stepper rail (mockup `.rail`): a thick ink
            pipe with an arrow-capped end runs behind the step tabs on lg;
            mobile keeps the horizontal wrap without the pipe. */}
        <aside className="wiz-rail">
          <nav aria-label="Steps" className="wiz-rail-nav">
            {/* The pipe — thick, runs behind the tabs (lg only). */}
            <span aria-hidden="true" className="wiz-rail-pipe" style={pipeStyle} />
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
            <span aria-hidden="true" className="wiz-rail-stub" style={pipeStubStyle}>
              <span style={arrowheadStyle} />
            </span>
          </nav>
        </aside>

        {/* (b) flex-1 main pane — always owns the step heading */}
        <main className="wiz-main" style={mainStyle}>
          {tintedStepCard ? (
            /* Blown-up tinted step card (mockup `.stepcard`): tone-card fill,
               flush ink number tab, condensed step head in the card ink. */
            <div className="wiz-step-frame" style={{ ...fillStyle, paddingBottom: contentPad }}>
              <article
                /* `sm:pl-12` (48px) is LOAD-BEARING, not a taste-level inset: it
                   is the gutter the overhanging number tab below is measured
                   against. The tab is `w-14` (56px) at `-left-5` (-20px), so its
                   right edge lands 36px inside the card — at 32px the content box
                   would start 4px to the LEFT of that, and the black tab would
                   print over the step title's first glyph and the RuleBrief
                   panel's left edge. 48px clears it by 12px.
                   Same overhang-plus-clearance relationship as `ModeDoor`'s tab.
                   Move one of the three numbers and you must move the others. */
                className="wiz-step-card"
                style={{
                  ...stepCardStyle,
                  background: 'var(--tone-card, var(--tone))',
                  // Card ink, ONE rule for all three sheets: every step card is
                  // now a light tint derived from its page tone, so all of them
                  // take dark ink (6.8–9.7:1). Content sitting directly on the
                  // card — the step head included — inherits via `text-current`.
                  color: 'var(--tone-card-ink, var(--color-ink))',
                }}
              >
                <span aria-hidden="true" className="wiz-step-tab" style={stepTabStyle}>
                  {active + 1}
                </span>
                <header>
                  {/* The title INHERITS `--tone-card-ink` from the article
                      (`text-current`) instead of hardcoding `text-paper`. White
                      was safe only while the step cards were dark book literals;
                      now that every card is a light tint derived from its page
                      tone, a white title measures 1.54:1 on the pilot fill and
                      1.91 / 2.18 on mech and crawler — invisible.
                      Inheriting keeps the title and the body copy on the same
                      ink rule, so a future dark card flips both together. The
                      dark `text-shadow` went with it: it existed to lift white
                      type off a saturated fill and only muddies dark type. */}
                  <h1 style={stepCardTitleStyle}>
                    <span className="su-sr-only">
                      Step {active + 1} of {steps.length} ·{' '}
                    </span>
                    {title}
                  </h1>
                  {subtitle && <div style={subtitleStyle}>{subtitle}</div>}
                </header>
                <div style={stepCardBodyStyle}>{children}</div>
              </article>
            </div>
          ) : (
            <>
              {heading}
              <div style={{ ...fillStyle, marginTop: tokens.space[20], paddingBottom: contentPad }}>
                {children}
              </div>
            </>
          )}

          {notice && <div style={noticeStyle}>{notice}</div>}

          {/* Footer — floats sticky at the bottom-right of the viewport as the
              content scrolls, so confirm/nav stays reachable without a
              full-width bar eating vertical space. The footer itself is
              click-through (pointer-events-none); only the ink action pill
              (mockup `.pill`) is interactive. Below the sm endpoint the pill
              stacks with a full-width primary CTA on EVERY step — Back/Cancel
              share a row above it.

              With a `footerHud`, the pill is MOUNTED inside a wide paper bar that
              also carries the step HUD (the mech Loadout gauges + chips) — one
              floating interface, no second overlay competing for the corner. */}
          <footer
            className={footerHud ? 'wiz-footer--hud' : undefined}
            style={footerHud ? footerStyle : footerPillStyle}
          >
            {footerHud ? (
              <div className="wiz-hud" style={hudStyle}>
                <div style={hudContentStyle}>{footerHud}</div>
                {actionPill}
              </div>
            ) : (
              actionPill
            )}
          </footer>
        </main>
      </div>
    </div>
  )
}
