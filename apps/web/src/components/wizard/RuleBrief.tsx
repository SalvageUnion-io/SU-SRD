import type { CSSProperties, ReactNode } from 'react'
import type { BookCite } from 'salvageunion-reference'
import { formatCite } from 'salvageunion-reference'
import type { Paint } from '../entity/parts/paint'
import { TitledBox, tokens } from '../index'

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

/** The cite under the rule: plain text, as every foot cites (E9). */
const citeStyle = {
  color: tokens.color.wkMuted,
  fontFamily: tokens.font.cond,
  fontSize: tokens.fontSize.badge,
  fontWeight: tokens.weight.semibold,
  letterSpacing: tokens.tracking.caps,
  margin: 0,
  textTransform: 'uppercase',
} satisfies CSSProperties

/** The band: the surface's own tone (`--tone`, the wizard's unit colour); the name is on the paper tab. */
const TONE_PAINT = {
  background: 'var(--tone)',
  color: 'var(--color-ink)',
  ink: false,
  nameOnPaper: false,
} satisfies Paint

/**
 * RuleBrief — the "THE RULE" box heading every wizard step (mockup Screens
 * 01/02 `.rulebrief`): a `TitledBox` whose band wears the wizard's tone, THE RULE on
 * its cut-out, the rule text on the paper below and its citation under it.
 */
export function RuleBrief({ rule, cite, className }: RuleBriefProps) {
  return (
    <TitledBox
      as="section"
      title="The Rule"
      label="The rule"
      paint={TONE_PAINT}
      className={className}
    >
      <p style={ruleStyle}>{rule}</p>
      {cite && <p style={citeStyle}>{formatCite(cite)}</p>}
    </TitledBox>
  )
}
