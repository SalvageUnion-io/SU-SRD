/**
 * OffRulesEscape — the in-wizard exit to the Free-Edit Live Sheet (ADR-021,
 * P3.3). Guided Creation hard-gates an illegal build; this is the sanctioned
 * escape for a house-ruled one: leave the guardrails and build it blank on the
 * Live Sheet, where nothing is enforced. Rendered in the WizShell action pill,
 * subordinate to the CTA — shown only while a gate is actively blocking.
 */

import type { CSSProperties } from 'react'
import '../../styles/build/wizard.css'
import { capsLabel } from '../../components/atoms/capsLabel'
import { tokens } from '../../components/index'
import { cn } from '../../lib/cn'

/**
 * Static half; the colour, which brightens on hover, is `.su-wiz-off-rules`.
 * It sits on the pill's line beside Cancel and the CTA, so it takes their Full
 * Size (§4.7): a 44px box, its words centred in it.
 */
const escapeStyle = {
  alignItems: 'center',
  cursor: 'pointer',
  display: 'inline-flex',
  minHeight: tokens.size.full,
  textDecorationLine: 'underline',
  textDecorationStyle: 'dotted',
  textUnderlineOffset: '2px',
  whiteSpace: 'nowrap',
} satisfies CSSProperties satisfies CSSProperties
const escapeCaps = capsLabel({ size: 'badge', weight: 'semibold' })

type OffRulesEscapeProps = {
  /** Leaves the guided flow for the blank Free-Edit path. */
  onEscape: () => void
}

export function OffRulesEscape({ onEscape }: OffRulesEscapeProps) {
  return (
    <button
      type="button"
      onClick={onEscape}
      className={cn('su-wiz-off-rules', escapeCaps)}
      style={escapeStyle}
    >
      Off-rules build? Build it on the Live Sheet →
    </button>
  )
}
