import type { CSSProperties, ReactNode } from 'react'
import type { BookCite } from 'salvageunion-reference'
import { formatCite } from 'salvageunion-reference'
import { SheetSectionCard, tokens } from '../../../ui/index'

/** Per-step rule metadata carried by each wizard's step table. */
export type StepRule = {
  /** 1–3 sentences of paraphrased rule text (or the step's description). */
  rule: ReactNode
  /** Where the rule is printed, as `{ source, page }`; `formatCite` prints the footer. */
  cite?: BookCite
}

type RuleBriefProps = StepRule & {
  className?: string
}

const ruleStyle = {
  color: tokens.color.ink,
  fontFamily: tokens.font.body,
  fontSize: tokens.fontSize.sm,
  lineHeight: 1.625,
  margin: 0,
  maxWidth: '70ch',
} satisfies CSSProperties

/**
 * RuleBrief — the "THE RULE" callout heading every wizard step
 * (mockup Screens 01/02 `.rulebrief`). Composes SheetSectionCard (the
 * poster `.dcard` frame) so the wizard inherits the live sheets' section
 * language verbatim: black THE RULE stamp in a `var(--tone)` header band, the
 * rule text on paper behind the deep-tone left rule, and the citation in the
 * accent footer.
 *
 * Steps without exact Workshop Manual copy yet pass their existing description as
 * `rule` — per-step rule text is filled in by Phases 3–5.
 */
export function RuleBrief({ rule, cite, className }: RuleBriefProps) {
  return (
    <section aria-label="The rule" className={className}>
      <SheetSectionCard title="The Rule" source={cite ? formatCite(cite) : undefined}>
        <p style={ruleStyle}>{rule}</p>
      </SheetSectionCard>
    </section>
  )
}
