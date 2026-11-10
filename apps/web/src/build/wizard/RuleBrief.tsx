import type { CSSProperties, ReactNode } from 'react'
import { useId, useState } from 'react'
import type { BookCite } from 'salvageunion-reference'
import { formatCite } from 'salvageunion-reference'
import { Box, Button, Eyebrow, tokens } from '../../components/index'
import { cn } from '../../lib/cn'
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
  /**
   * A wizard step's brief: on a phone a long rule shows its first two lines
   * and a `Read the rule` toggle, so the step's picks start on the first
   * screen. The cite always shows.
   */
  fold?: boolean
}

/** A rule shorter than this fits two phone lines: nothing to fold. */
const FOLD_FROM = 120

/** The cite and the fold's toggle on one line. */
const footStyle = {
  alignItems: 'center',
  display: 'flex',
  flexWrap: 'wrap',
  gap: tokens.space[8],
  justifyContent: 'space-between',
} satisfies CSSProperties

const ruleStyle = {
  color: tokens.color.ink,
  fontFamily: tokens.font.body,
  fontSize: tokens.fontSize.body,
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
export function RuleBrief({ rule, cite, className, fold = false }: RuleBriefProps) {
  const [open, setOpen] = useState(false)
  const ruleId = useId()
  const folds = fold && typeof rule === 'string' && rule.length > FOLD_FROM
  return (
    <Box as="section" label={buildWizardCopy('theRule')} className={className}>
      <p id={ruleId} className={cn(folds && !open && 'su-wiz-rule--folded')} style={ruleStyle}>
        {rule}
      </p>
      {(cite || folds) && (
        <div style={footStyle}>
          {cite && (
            <Eyebrow as="p" tone="muted" style={citeStyle}>
              {formatCite(cite)}
            </Eyebrow>
          )}
          {folds && (
            <Button
              size="mini"
              className="su-wiz-rule-toggle"
              aria-expanded={open}
              aria-controls={ruleId}
              onClick={() => setOpen((was) => !was)}
            >
              {buildWizardCopy(open ? 'foldTheRule' : 'readTheRule')}
            </Button>
          )}
        </div>
      )}
    </Box>
  )
}
