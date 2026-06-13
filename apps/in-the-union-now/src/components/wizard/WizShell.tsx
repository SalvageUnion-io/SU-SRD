import type { ReactNode } from 'react'
import { Btn, Stepper } from 'suref-react'
import { cn } from '../../lib/utils'

type WizShellProps = {
  /** Rail eyebrow, e.g. 'New Pilot' / 'Edit Pilot'. */
  eyebrow: string
  /** Ordered step labels — also drives the primary CTA ('Next · {label} →'). */
  steps: readonly string[]
  /** Index of the active step. */
  active: number
  /** When provided, completed stepper entries navigate back. */
  onStepClick?: (index: number) => void
  /** Step heading (h1 22–23px cond per design §3.2). */
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
  onBack?: () => void
  onCancel: () => void
  /** Advances to the next step, or submits on the last step. */
  onNext: () => void
  nextDisabled?: boolean
  /** Disables all footer actions while a submit is in flight. */
  busy?: boolean
  /** Final-step CTA label, e.g. 'Create Pilot ✦' / 'Save Pilot'. */
  submitLabel: string
  /**
   * Renders the primary CTA full-width below the content instead of in the
   * right-aligned footer slot — design §3.2 mech install steps
   * ('full-width Next · Modules → below').
   */
  ctaFullWidth?: boolean
}

/**
 * Shared wizard skeleton (design-spec §3.2): 196px stepper rail · optional
 * 320px option pane · flex-1 main pane with a ghost Back/Cancel + primary CTA
 * footer. The CTA label is generated from the steps array; the shell is
 * layout-only — all wizard state lives in the caller.
 *
 * Mobile (≤lg) stacks the panes full-width with a horizontal stepper.
 */
export function WizShell({
  eyebrow,
  steps,
  active,
  onStepClick,
  title,
  subtitle,
  optionPane,
  children,
  notice,
  onBack,
  onCancel,
  onNext,
  nextDisabled = false,
  busy = false,
  submitLabel,
  ctaFullWidth = false,
}: WizShellProps) {
  const isLast = active >= steps.length - 1
  const ctaLabel = isLast ? submitLabel : `Next · ${steps[active + 1]} →`

  const heading = (
    <header>
      <h1 className="font-cond text-[23px] font-bold uppercase leading-tight tracking-[0.01em] text-ink">
        {title}
      </h1>
      {subtitle && <div className="mt-1 font-body text-[13px] text-wk-muted">{subtitle}</div>}
    </header>
  )

  return (
    <div className="flex min-h-dvh flex-col bg-wk-bg lg:flex-row">
      {/* (a) 196px stepper rail */}
      <aside className="shrink-0 border-b-[1.5px] border-ink px-4 py-4 lg:w-[196px] lg:border-b-0 lg:border-r-[1.5px] lg:px-5 lg:py-9">
        <p className="mb-3 font-cond text-sm font-bold uppercase tracking-[0.12em] text-rust">
          {eyebrow}
        </p>
        <Stepper
          steps={[...steps]}
          active={active}
          onStepClick={busy ? undefined : onStepClick}
          className="flex-row flex-wrap lg:flex-col"
        />
      </aside>

      {/* (b) optional 320px option pane — owns the step heading when present */}
      {optionPane && (
        <section className="shrink-0 border-b-[1.5px] border-ink px-5 py-5 lg:w-[320px] lg:overflow-y-auto lg:border-b-0 lg:border-r-[1.5px] lg:px-[26px] lg:py-9">
          {heading}
          <div className="mt-4">{optionPane}</div>
        </section>
      )}

      {/* (c) flex-1 main pane */}
      <main className="flex min-w-0 flex-1 flex-col px-5 py-5 lg:px-10 lg:py-[34px]">
        {!optionPane && heading}
        <div className={cn('min-h-0 flex-1', !optionPane && 'mt-4')}>{children}</div>

        {notice && <div className="mt-6">{notice}</div>}

        <footer
          className={cn(
            'mt-6 border-t-[1.5px] border-wk-faint pt-4',
            ctaFullWidth ? 'flex flex-col gap-3' : 'flex items-center justify-between gap-3'
          )}
        >
          {ctaFullWidth && (
            <Btn
              variant="primary"
              size="lg"
              className="w-full"
              onClick={onNext}
              disabled={nextDisabled || busy}
            >
              {busy ? 'Saving…' : ctaLabel}
            </Btn>
          )}
          <div className="flex gap-2">
            {onBack && (
              <Btn variant="ghost" onClick={onBack} disabled={busy}>
                Back
              </Btn>
            )}
            <Btn variant="ghost" onClick={onCancel} disabled={busy}>
              Cancel
            </Btn>
          </div>
          {!ctaFullWidth && (
            <Btn variant="primary" size="lg" onClick={onNext} disabled={nextDisabled || busy}>
              {busy ? 'Saving…' : ctaLabel}
            </Btn>
          )}
        </footer>
      </main>
    </div>
  )
}
