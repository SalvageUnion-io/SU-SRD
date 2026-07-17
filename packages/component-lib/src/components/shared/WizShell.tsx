import { useState } from 'react'
import type { ReactNode } from 'react'
import { Btn } from '../chrome/Btn'
import { cn } from '../../utils/cn'
import { ModalShell } from './ModalShell'

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
  /**
   * Optional 320px master pane (OptRow lists). When present the shell renders
   * the three-pane master-detail layout with title/subtitle in this pane;
   * otherwise title/subtitle head the main pane (grid/form/review variant).
   */
  optionPane?: ReactNode
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
   * discarding — a mis-tap can no longer destroy a multi-step build
   * (audit item 3). Default false keeps pristine forms one-click.
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

/**
 * Black tracker tab (wizard-refresh mockup `.tracker`): condensed-caps label
 * with an amber value, hosted in the WizShell action pill. Phase 2 chrome —
 * values reflect today's wizard state; real budget math lands in Phases 3–5.
 */
export function WizTracker({ label, value }: { label: string; value: ReactNode }) {
  return (
    <span className="inline-flex items-baseline gap-2 whitespace-nowrap rounded-[2px] bg-ink px-3 py-1.5 font-cond text-[13px] font-bold uppercase leading-none tracking-caps text-paper shadow-[inset_0_0_0_1.5px_rgba(255,255,255,0.28)]">
      <span>{label}</span>
      <span className="text-[15px] tracking-caps-tight text-su-orange">{value}</span>
    </span>
  )
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
      className={cn(
        'relative z-[1] flex items-center gap-2.5 text-left disabled:pointer-events-none lg:my-[6px]',
        clickable && 'cursor-pointer'
      )}
    >
      {/* Sharp ink number tab: done = amber check, active = enlarged + tone
          ring, future = hollow ink-outlined block (never opacity-faded). */}
      <span
        aria-hidden="true"
        className={cn(
          'grid shrink-0 place-items-center rounded-[2px] font-cond font-bold',
          active
            ? 'h-11 w-11 bg-ink text-[23px] text-paper shadow-[0_0_0_4px_var(--tone)] lg:-ml-[5px]'
            : 'h-[34px] w-[34px]',
          !active && done && 'bg-ink text-[17px] text-su-orange',
          !active &&
            !done &&
            'bg-paper text-[17px] text-ink shadow-[inset_0_0_0_2.5px_var(--color-ink)]'
        )}
      >
        {done ? '✓' : index + 1}
      </span>
      <span
        className={cn(
          'hidden font-cond font-bold uppercase leading-[1.15] tracking-caps-snug text-ink min-[721px]:block',
          active ? 'text-[13px]' : 'text-[11.5px]',
          done && !active && 'opacity-80',
          !done && !active && 'opacity-[0.66]'
        )}
      >
        {label}
      </span>
    </button>
  )
}

/**
 * Shared wizard skeleton, reskinned as a poster sibling (wizard-refresh
 * Phase 2, mockup Screens 01/02): the `.sheet--{kind}` tone context on the
 * `var(--ground)` page, a tone band banner up top, the manual's connector-pipe
 * stepper rail (196px), optional 320px option pane, and a flex-1 main pane
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
  optionPane,
  children,
  notice,
  trackers,
  footerNote,
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

  const heading = (
    <header>
      <h1 className="m-0">
        {/* Ink-stamp step heading (SheetHero name-chip treatment). */}
        <span className="inline bg-ink box-decoration-clone px-2 pb-[3px] pt-[2px] font-cond text-[22px] font-bold uppercase leading-[1.35] tracking-[0.01em] text-paper">
          <span className="text-su-orange">
            Step {active + 1} of {steps.length}
          </span>
          {' · '}
          <span>{title}</span>
        </span>
      </h1>
      {subtitle && <div className="mt-2 font-body text-caption text-ink-2">{subtitle}</div>}
    </header>
  )

  return (
    <div
      className={cn(`sheet--${kind}`, 'flex min-h-dvh flex-col')}
      style={{ background: 'var(--ground)' }}
    >
      {/* Poster band (mockup `.band`/`.banner`): tone ground, white condensed
          banner, a white rule then a thin tone bandtail below it. */}
      <header
        className="border-b-4 border-paper/95 px-5 pb-2.5 pt-5 sm:px-7"
        style={{ background: 'var(--tone)' }}
      >
        <p className="m-0 font-cond text-[clamp(26px,4vw,40px)] font-bold uppercase leading-[0.98] tracking-[0.5px] text-paper [text-shadow:0_2px_0_rgba(0,0,0,0.22)]">
          {eyebrow}
        </p>
      </header>
      <div className="h-2 shrink-0" style={{ background: 'var(--tone)' }} aria-hidden="true" />

      <div className="flex flex-1 flex-col lg:flex-row">
        {/* (a) 196px connector-pipe stepper rail (mockup `.rail`): a thick ink
            pipe with an arrow-capped end runs behind the step tabs on lg;
            mobile keeps the horizontal wrap without the pipe. */}
        <aside
          className={cn(
            'shrink-0 border-b-chrome border-ink px-4 py-4 lg:border-b-0 lg:border-r-0 lg:px-4 lg:py-7',
            'lg:w-[196px]'
          )}
        >
          <nav
            aria-label="Steps"
            className="relative flex flex-row flex-wrap gap-x-3 gap-y-2 lg:flex-col lg:gap-0 lg:pb-16 lg:pl-1"
          >
            {/* The pipe — thick, runs behind the tabs (lg only). */}
            <span
              aria-hidden="true"
              className="absolute bottom-12 left-[4px] top-1 hidden w-7 rounded-t-xl bg-ink lg:block"
            />
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
            <span
              aria-hidden="true"
              className="absolute bottom-3 left-[4px] hidden h-9 w-7 justify-center rounded-b-lg bg-ink lg:flex"
            >
              <span className="mt-2.5 h-0 w-0 border-x-[9px] border-t-[14px] border-x-transparent border-t-paper" />
            </span>
          </nav>
        </aside>

        {/* (b) optional 320px option pane — carries only its list; the step
            heading always renders in the main pane so the h1 stays anchored
            horizontally across every step (option-pane steps and others alike) */}
        {optionPane && (
          <section
            className={cn(
              'shrink-0 border-b-chrome border-ink px-5 py-5 lg:overflow-y-auto lg:border-b-0 lg:border-r-chrome lg:px-6 lg:py-9',
              'lg:w-[320px]'
            )}
          >
            {optionPane}
          </section>
        )}

        {/* (c) flex-1 main pane — always owns the step heading */}
        <main className="flex min-w-0 flex-1 flex-col px-5 py-5 lg:px-10 lg:py-[30px]">
          {tintedStepCard ? (
            /* Blown-up tinted step card (mockup `.stepcard`): tone-card fill,
               flush ink number tab, white condensed step head. */
            <div className="min-h-0 flex-1 pb-24 sm:pl-5">
              <article
                className="relative rounded-xl px-5 pb-6 pt-5 shadow-[0_14px_26px_-14px_rgba(0,0,0,0.4),inset_0_0_46px_rgba(0,0,0,0.08)] sm:pl-8"
                style={{
                  background: 'var(--tone-card, var(--tone))',
                  // Card ink: rust (mech) needs WHITE body ink for legible
                  // contrast; sky blue / peach keep dark ink. Content that
                  // sits directly on the card inherits via `text-current`.
                  color: 'var(--tone-card-ink, var(--color-ink))',
                }}
              >
                <span
                  aria-hidden="true"
                  className="absolute -left-5 top-6 hidden h-16 w-14 place-items-center rounded-[2px] bg-ink font-cond text-[38px] font-extrabold leading-none text-paper shadow-[0_8px_14px_-8px_rgba(0,0,0,0.55)] sm:grid"
                >
                  {active + 1}
                </span>
                <header>
                  <h1 className="m-0 font-cond text-[25px] font-bold uppercase leading-[1.05] text-paper [text-shadow:0_1px_0_rgba(0,0,0,0.38)]">
                    <span className="sr-only">
                      Step {active + 1} of {steps.length} ·{' '}
                    </span>
                    {title}
                  </h1>
                  {subtitle && (
                    <div className="mt-2 font-body text-caption text-ink-2">{subtitle}</div>
                  )}
                </header>
                <div className="mt-4">{children}</div>
              </article>
            </div>
          ) : (
            <>
              {heading}
              <div className="mt-5 min-h-0 flex-1 pb-24">{children}</div>
            </>
          )}

          {notice && <div className="mt-6">{notice}</div>}

          {/* Footer — floats sticky at the bottom-right of the viewport as the
              content scrolls, so confirm/nav stays reachable without a
              full-width bar eating vertical space. The footer itself is
              click-through (pointer-events-none); only the ink action pill
              (mockup `.pill`) is interactive. Below the sm endpoint the pill
              stacks with a full-width primary CTA on EVERY step (design review
              U-6) — Back/Cancel share a row above it. */}
          <footer className="pointer-events-none sticky bottom-4 z-40 mt-6 flex justify-end">
            <div className="pointer-events-auto flex w-full flex-col items-stretch gap-2 rounded-2xl bg-ink p-2.5 shadow-[0_16px_28px_-12px_rgba(0,0,0,0.6)] sm:w-auto sm:flex-row sm:items-center sm:gap-3 sm:rounded-full sm:pl-4">
              {trackers && (
                <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-start">
                  {trackers}
                </div>
              )}
              {footerNote && (
                <p
                  role="status"
                  className="m-0 px-2 text-center font-cond text-xs font-semibold uppercase tracking-caps text-su-orange sm:text-left"
                >
                  {footerNote}
                </p>
              )}
              {escapeAction && (
                <div className="flex justify-center px-2 sm:justify-start">{escapeAction}</div>
              )}
              {/* Ghost nav row on phones; dissolves into the pill row ≥ sm. */}
              <div className="flex items-center justify-end gap-2 sm:contents">
                {onBack && (
                  <Btn
                    variant="ghost"
                    onClick={onBack}
                    disabled={busy}
                    className="border-paper/40 text-paper hover:bg-paper/10"
                  >
                    Back
                  </Btn>
                )}
                <Btn
                  variant="ghost"
                  onClick={() => (confirmCancel ? setConfirmingCancel(true) : onCancel())}
                  disabled={busy}
                  className="border-paper/40 text-paper hover:bg-paper/10"
                >
                  Cancel
                </Btn>
                <ModalShell
                  open={confirmingCancel}
                  onOpenChange={(next) => {
                    if (!next) setConfirmingCancel(false)
                  }}
                  title="Discard this draft?"
                  headerBg="bg-su-rust"
                  maxWidth="max-w-md"
                  align="center"
                >
                  <div className="flex flex-col gap-4 bg-paper p-5">
                    <div className="font-body text-sm text-wk-muted">
                      Your unsaved changes will be lost.
                    </div>
                    <div className="flex justify-end gap-2">
                      <Btn variant="ghost" size="sm" onClick={() => setConfirmingCancel(false)}>
                        Keep editing
                      </Btn>
                      <Btn
                        variant="danger"
                        size="sm"
                        onClick={() => {
                          setConfirmingCancel(false)
                          onCancel()
                        }}
                      >
                        Discard
                      </Btn>
                    </div>
                  </div>
                </ModalShell>
              </div>
              {/* Locked CTA (mockup `.next.locked`): hollow, dashed, dimmed
                  weight — the blocking reason lives in the footerNote text. */}
              <Btn
                variant="primary"
                size="lg"
                className={cn(
                  'w-full rounded-full sm:w-auto',
                  nextDisabled &&
                    !busy &&
                    'border-2 border-dashed border-paper/55 bg-transparent font-normal text-paper/60 shadow-none disabled:opacity-100'
                )}
                onClick={onNext}
                disabled={nextDisabled || busy}
              >
                {busy ? 'Saving…' : ctaLabel}
              </Btn>
            </div>
          </footer>
        </main>
      </div>
    </div>
  )
}
