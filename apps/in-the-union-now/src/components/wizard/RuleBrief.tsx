import type { ReactNode } from 'react'
import { SheetSectionCard } from '../sheet/SheetSectionCard'

/** Per-step rule metadata carried by each wizard's step table. */
export type StepRule = {
  /** 1–3 sentences of paraphrased rule text (or the step's description). */
  rule: ReactNode
  /** Citation caption, e.g. 'Core Book · p.94'. */
  cite?: string
}

type RuleBriefProps = StepRule & {
  className?: string
}

/**
 * RuleBrief — the "THE RULE" callout heading every wizard step (wizard-refresh
 * Phase 2, mockup Screens 01/02 `.rulebrief`). Composes SheetSectionCard (the
 * poster `.dcard` frame) so the wizard inherits the live sheets' section
 * language verbatim: black THE RULE stamp in a `var(--tone)` header band, the
 * rule text on paper behind the deep-tone left rule, and the citation in the
 * accent footer.
 *
 * Steps without exact Core Book copy yet pass their existing description as
 * `rule` — per-step rule text is filled in by Phases 3–5.
 */
export function RuleBrief({ rule, cite, className }: RuleBriefProps) {
  return (
    <section aria-label="The rule" className={className}>
      <SheetSectionCard title="The Rule" source={cite}>
        <p className="m-0 max-w-[70ch] font-body text-sm leading-relaxed text-ink">{rule}</p>
      </SheetSectionCard>
    </section>
  )
}
