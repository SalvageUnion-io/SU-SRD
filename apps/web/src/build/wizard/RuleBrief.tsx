import type { CSSProperties, ReactNode } from 'react'
import type { BookCite } from 'salvageunion-reference'
import { formatCite } from 'salvageunion-reference'
import { Box } from '../../components/containers/Box'
import { Eyebrow, tokens } from '../../components/index'
import { buildWizardCopy } from '../../messages/build-wizard'

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
const citeStyle = { margin: 0 } satisfies CSSProperties

/**
 * RuleBrief — the rule a wizard step (or a blocked Play action) answers
 * to: an untitled `Box` inside the step's own untitled frame, the rule text on
 * its paper and its citation under it. The step's title names the section; the
 * box carries no title of its own, only the
 * landmark's name for a screen reader.
 */
export function RuleBrief({ rule, cite, className }: RuleBriefProps) {
  return (
    <Box as="section" label={buildWizardCopy('theRule')} className={className}>
      <p style={ruleStyle}>{rule}</p>
      {cite && (
        <Eyebrow as="p" tone="muted" style={citeStyle}>
          {formatCite(cite)}
        </Eyebrow>
      )}
    </Box>
  )
}
