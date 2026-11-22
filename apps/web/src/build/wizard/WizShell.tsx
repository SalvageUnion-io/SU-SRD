import type { SheetKind } from 'game-domain/entityKinds'
import { ChevronDown } from 'lucide-react'
import type { ReactNode } from 'react'
import { useEffect, useRef, useState } from 'react'
import { ConfirmDialog, NextLabel } from '../../components/app'
import { Badge, Box, Button, ChapterBand, HeaderMenu, tokens } from '../../components/index'
import type { KeepAsFileActs } from './KeepAsFile'
import { KeepAsFile } from './KeepAsFile'
import { SaveSignInDialog } from './SaveSignInDialog'
import { SignedInBack } from './SignedInBack'
import { WIZ_NEXT_ID } from './SkipToNext'
import { WizardGameChip } from './WizardGameChip'
import { WizRail } from './WizRail'
import { WizStartLines } from './WizStarts'
import { promptShows, scrollToAsked, useInView } from './wizPrompt.model'
import {
  ctaLockedStyle,
  ctaStyle,
  keepRowStyle,
  pillNavStyle,
  pillStyle,
  pillTrackersStyle,
  promptStyle,
  STEP_BODY,
  stepHeadStyle,
  stepNoteStyle,
  stepNumberStyle,
  stepTitleCaps,
  stepTitleStyle,
  tryNoteStyle,
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
  /**
   * A saved unit's redesign (`useWizardFlow`'s `existing`): every step's
   * action is the save, and Next steps on beside Back (a phone shows
   * its chevron alone).
   */
  saveNow?: (() => void) | undefined
  nextDisabled?: boolean
  /** Disables all footer actions while a submit is in flight. */
  busy?: boolean
  /** Final-step CTA label, e.g. 'Create Pilot ✦' / 'Save Pilot'. */
  submitLabel: string
  /** Saving signed out: the sign-in ask over the kept draft (`useWizardFlow`). */
  signIn?: { open: boolean; onClose: () => void }
  /** A line under the step's title: signed out, step 1 says saving needs a sign-in. */
  tryNote?: string | undefined
  /** Back from Save's sign-in on the last step: the bar says the Save is still to press (r5 C14). */
  signedInBack?: boolean
  /** Signed out on the last step: the build kept as a file or on paper (`KeepAsFile`). */
  keepAsFile?: KeepAsFileActs | undefined
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
  saveNow,
  nextDisabled = false,
  busy = false,
  submitLabel,
  confirmCancel = false,
  signIn,
  tryNote,
  signedInBack = false,
  keepAsFile,
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
  // A redesign saves from any step; its Next is a ghost beside Back.
  const savesHere = saveNow !== undefined && !isLast
  const nextLabel = (
    <NextLabel to={steps[active + 1]} size="full" wordClassName="su-wiz-pill-next" />
  )
  const ctaLabel =
    isLast || savesHere
      ? submitLabel
      : // One "Next:", read at every width and seen from sm (`wizard.css`): a
        // second, hidden copy beside it was read out twice by a text reader.
        nextLabel
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
        {savesHere && (
          <Button
            variant="ghost"
            size="full"
            className="su-wiz-pill-step"
            onClick={onNext}
            disabled={nextDisabled || busy}
          >
            {/* A phone shows its chevron and reads its name (`wizard.css`). */}
            <NextLabel
              to={<span className="su-wiz-pill-step-name">{steps[active + 1]}</span>}
              size="full"
              wordClassName="su-wiz-pill-next"
            />
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
        id={WIZ_NEXT_ID}
        className="su-wiz-pill-cta"
        style={nextDisabled && !busy ? ctaLockedStyle : ctaStyle}
        onClick={savesHere ? saveNow : onNext}
        disabled={nextDisabled || busy}
      >
        {busy ? buildWizardCopy('saving') : ctaLabel}
      </Button>
    </div>
  )

  return (
    <div className={`su-wiz-shell su-sheet--${kind}`}>
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

      <div className="su-wiz-body">
        <WizRail
          steps={steps}
          active={active}
          reached={reached}
          onStepClick={onStepClick && !busy ? onStepClick : undefined}
        />

        {/* (b) flex-1 main pane — always owns the step heading. A plain
            block: the route wraps the wizard in the page's one <main>. */}
        <div className="su-wiz-main">
          {/* The step (N6): its number stamp and h1 over an untitled frame,
              with no band, so the entities in it are the titled things. */}
          <div className="su-wiz-step-frame">
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
              {saveNow === undefined && <WizStartLines active={active} />}
              {tryNote && <p style={tryNoteStyle}>{tryNote}</p>}
              <Box body="flush">
                <div className={STEP_BODY}>
                  {/* Before the build, so it is seen with Create and before
                      the sign-in ask (r3 E2). Chrome: paper leaves it out. */}
                  {keepAsFile && (
                    <div data-print="hide" style={keepRowStyle}>
                      <KeepAsFile {...keepAsFile} />
                    </div>
                  )}
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
          <footer className="su-wiz-footer" data-print="hide">
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
            {signedInBack && isLast && <SignedInBack submitLabel={submitLabel} />}
            {actionPill}
          </footer>
          {signIn && (
            <SaveSignInDialog open={signIn.open} onClose={signIn.onClose} keep={keepAsFile} />
          )}
        </div>
      </div>
    </div>
  )
}
