import type { SheetKind } from 'game-domain/entityKinds'
import { Check, ChevronDown } from 'lucide-react'
import type { CSSProperties, ReactNode } from 'react'
import { useEffect, useRef, useState } from 'react'
import { ConfirmDialog, NextLabel, TrackStep } from '../../components/app'
import {
  Badge,
  Box,
  Button,
  ChapterBand,
  capsLabel,
  HeaderMenu,
  tokens,
} from '../../components/index'
import { SaveSignInDialog } from './SaveSignInDialog'
import { WizardGameChip } from './WizardGameChip'
import { promptShows, scrollToAsked, useInView } from './wizPrompt.model'
import {
  bodyStyle,
  ctaLockedStyle,
  ctaStyle,
  footerPillStyle,
  mainStyle,
  pillNavStyle,
  pillStyle,
  pillTrackersStyle,
  promptStyle,
  STEP_BODY,
  shellStyle,
  shellUnderBandStyle,
  stepFrameStyle,
  stepHeadStyle,
  stepNoteStyle,
  stepNumberStyle,
  stepTitleCaps,
  stepTitleStyle,
} from './wizShellStyles.model'
import '../../styles/build/wizard.css'
import { cn } from '../../lib/cn'
import { buildWizardCopy } from '../../messages/build-wizard'

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
   * The Game the wizard was started for (`?game=<id>`, ADR-052 §3): its
   * relation chip, `GAME | name`, on the band beside the title.
   */
  gameId?: string | undefined
  /**
   * Draw the poster band. False when the page around the wizard draws its own
   * (the NPC designer's, which carries its Any NPC | Crawler crew tabs).
   */
  band?: boolean
  /** Ordered step labels — also drives the primary CTA (`NextLabel`: "Next: {label}"). */
  steps: readonly string[]
  /** Index of the active step. */
  active: number
  /** The furthest step reached (a reload or a step back keeps it): a way there. */
  reached?: number
  /** When provided, completed stepper entries navigate back. */
  onStepClick?: (index: number) => void
  /** Step heading — the page's h1 over the step's content, read as 'Step n of N · {title}'. */
  title: string
  /** Main pane content (detail card, pick grid, form, review). */
  children: ReactNode
  /**
   * The step's budgets in the action bar, live. Pass `WizTracker` elements; one
   * a phone keeps, the rest in `.su-wiz-pill-wide` (from sm).
   */
  trackers?: ReactNode
  /**
   * Why Next is locked, in one line under the step's content: the step it
   * locks says so, and the action bar stays its budgets and its buttons.
   */
  footerNote?: ReactNode
  /**
   * The way out of the guided rules: finish the build off-rules on the
   * Free-Edit Live Sheet (ADR-021). A row of the bar's ⋯ menu at every width,
   * shown while a gate is locked; omit to hide.
   */
  onEscape?: (() => void) | undefined
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
  /** Saving signed out: the sign-in ask over the kept draft (`useWizardFlow`). */
  signIn?: { open: boolean; onClose: () => void }
  /**
   * Said on the action bar, above the Next: something the step offers out of
   * sight (`Or start from a Pattern`), and the element a press scrolls to.
   * Without it the bar says a locked Next's reason (`footerNote`).
   */
  prompt?: { text: string; targetId: string } | undefined
  /**
   * Where the thing a locked Next waits for is (the First Ability table), so
   * the reason's press lands on it, not on the reason at the step's foot.
   */
  noteTargetId?: string | undefined
}

const STEP_NOTE_ID = 'wiz-step-note'

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
function WizRail({
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
    <aside className="su-wiz-rail">
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

/**
 * Shared wizard skeleton, a poster sibling: the `.su-sheet--{kind}` tone context
 * on the `var(--ground)` page, a tone band banner up top, the manual's
 * connector-pipe stepper rail (196px) and a flex-1 main pane holding the
 * step: its number stamp and h1 title over an untitled frame of its content
 * (ruleset N6: a container that holds entities is untitled, so the entities
 * in the step are the titled things), and the ink action bar on its reserved
 * strip at the foot (the budgets, ghost Back and Cancel, the rust Next).
 * The shell is layout-only — all wizard state lives in the caller.
 *
 * Under lg the panes stack full-width with a horizontal tab rail (labels
 * from md); on a phone the rail is one step line over a track of notches.
 */
export function WizShell({
  kind,
  eyebrow,
  gameId,
  band = true,
  steps,
  active,
  reached = active,
  onStepClick,
  title,
  children,
  trackers,
  footerNote,
  onEscape,
  onBack,
  onCancel,
  onNext,
  nextDisabled = false,
  busy = false,
  submitLabel,
  confirmCancel = false,
  signIn,
  prompt,
  noteTargetId,
}: WizShellProps) {
  const [confirmingCancel, setConfirmingCancel] = useState(false)
  // Every step opens at the top with focus on its heading (WCAG 2.4.3), the
  // first included: the page that led here (the chooser, a step's Next) may
  // have been left scrolled.
  const headingRef = useRef<HTMLHeadingElement | null>(null)
  const shownStep = useRef<number | null>(null)
  useEffect(() => {
    if (shownStep.current === active) return
    shownStep.current = active
    window.scrollTo(0, 0)
    headingRef.current?.focus({ preventScroll: true })
  }, [active])
  const isLast = active >= steps.length - 1
  // From sm the Next names its step in words ("Next: Systems & modules").
  const ctaLabel = isLast ? (
    submitLabel
  ) : (
    <>
      <span aria-hidden="true" className="su-wiz-pill-next">
        {buildWizardCopy('next')}
      </span>
      <NextLabel to={steps[active + 1]} size="full" />
    </>
  )
  const askCancel = () => (confirmCancel ? setConfirmingCancel(true) : onCancel())
  // The prompt's line: gone once pressed, and while its target is on screen.
  const promptTargetId = prompt?.targetId ?? noteTargetId ?? STEP_NOTE_ID
  const promptKey = `${active}:${prompt?.text ?? footerNote ?? ''}`
  const [used, setUsed] = useState<string | null>(null)
  const inView = useInView(prompt || footerNote ? promptTargetId : undefined)

  // The ink action bar: its trackers, ghost Back and Cancel, and the one rust
  // Next, so nothing in it outgrows the Next. It declares its ink ground
  // (chrome K1), so its ghost buttons read paper.
  const actionPill = (
    <div className="su-wiz-pill" data-ground="ink" style={pillStyle}>
      {trackers && (
        <div className="su-wiz-pill-start" style={pillTrackersStyle}>
          {trackers}
        </div>
      )}
      {/* Back and Cancel take the CTA's Full Size: one Size per line (§4.7).
          On a phone Cancel is the ⋯ menu's row. */}
      <div className="su-wiz-pill-nav" style={pillNavStyle}>
        {onBack && (
          <Button
            variant="ghost"
            size="full"
            className="su-wiz-pill-back"
            onClick={onBack}
            disabled={busy}
          >
            {buildWizardCopy('back')}
          </Button>
        )}
        <Button
          variant="ghost"
          size="full"
          className="su-wiz-pill-cancel"
          onClick={askCancel}
          disabled={busy}
        >
          {buildWizardCopy('cancel')}
        </Button>
        {/* On a phone (hard rule R44: nothing scrolls sideways) Back stays on
            the bar and Cancel and the escape are the ⋯ menu's rows. From sm
            the menu shows only while it holds the escape. */}
        <span className={cn('su-wiz-pill-more', onEscape && 'su-wiz-pill-more--escape')}>
          <HeaderMenu
            variant="overflow"
            size="full"
            trigger={null}
            label={buildWizardCopy('moreActions')}
            disabled={busy}
            sections={[
              onEscape
                ? [{ id: 'escape', label: buildWizardCopy('offRulesRow'), onSelect: onEscape }]
                : [],
              [{ id: 'cancel', label: buildWizardCopy('cancel'), onSelect: askCancel }],
            ]}
          />
        </span>
        <ConfirmDialog
          open={confirmingCancel}
          onOpenChange={setConfirmingCancel}
          title={buildWizardCopy('discardThisDraft')}
          tone="danger"
          body={buildWizardCopy('yourUnsavedChangesWillBe')}
          confirmLabel={buildWizardCopy('discard')}
          cancelLabel={buildWizardCopy('keepEditing')}
          onConfirm={onCancel}
        />
      </div>
      {/* Locked CTA: hollow, dimmed weight; the reason is on the step. */}
      <Button
        variant="primary"
        size="full"
        className="su-wiz-pill-cta"
        style={nextDisabled && !busy ? ctaLockedStyle : ctaStyle}
        onClick={onNext}
        disabled={nextDisabled || busy}
      >
        {busy ? buildWizardCopy('saving') : ctaLabel}
      </Button>
    </div>
  )

  return (
    <div className={`su-sheet--${kind}`} style={band ? shellStyle : shellUnderBandStyle}>
      {/* The page title as every other page sets it. A paragraph: the step's
          title is the page's h1. */}
      {band && (
        <ChapterBand
          tone={kind === 'npc' ? 'denizen' : kind}
          as="p"
          asideAt="notch"
          aside={gameId === undefined ? undefined : <WizardGameChip gameId={gameId} />}
        >
          {eyebrow}
        </ChapterBand>
      )}

      <div className="su-wiz-body" style={bodyStyle}>
        <WizRail
          steps={steps}
          active={active}
          reached={reached}
          onStepClick={onStepClick && !busy ? onStepClick : undefined}
        />

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
                <h1 ref={headingRef} tabIndex={-1} className={stepTitleCaps} style={stepTitleStyle}>
                  <span className="su-sr-only">
                    {buildWizardCopy('stepOf', { value: active + 1, count: steps.length })}{' '}
                  </span>
                  {title}
                </h1>
              </div>
              <Box body="flush">
                <div className={STEP_BODY}>
                  {children}
                  {footerNote && (
                    <p id={STEP_NOTE_ID} role="status" style={stepNoteStyle}>
                      {footerNote}
                    </p>
                  )}
                </div>
              </Box>
            </article>
          </div>

          {/* The action bar: a reserved strip pinned to the viewport's foot
              (never a card floating over the step), so Back and Next stay in
              reach as the step scrolls. On a phone it is one line: one
              budget, the ⋯ menu and the Next filling the rest. */}
          <footer className="su-wiz-footer" style={footerPillStyle}>
            {/* What the step still asks for, or offers further down, said
                where the Next is: a press scrolls to it. */}
            {(prompt ?? footerNote) && promptShows({ key: promptKey, used, inView }) && (
              <Button
                variant="ghost"
                size="compact"
                style={promptStyle}
                onClick={() => {
                  const target = document.getElementById(promptTargetId)
                  if (target) scrollToAsked(target)
                  setUsed(promptKey)
                }}
              >
                {prompt?.text ??
                  buildWizardCopy('nextReason', {
                    reason: String(footerNote).replace(/ to continue$/, ''),
                  })}
                <ChevronDown aria-hidden="true" size={tokens.iconSize.mini} />
              </Button>
            )}
            {actionPill}
          </footer>
          {signIn && <SaveSignInDialog open={signIn.open} onClose={signIn.onClose} />}
        </div>
      </div>
    </div>
  )
}
