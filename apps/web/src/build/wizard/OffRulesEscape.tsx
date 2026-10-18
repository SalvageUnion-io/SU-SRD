/**
 * OffRulesEscape — the in-wizard exit to the Free-Edit Live Sheet (ADR-021,
 * P3.3). Guided Creation hard-gates an illegal build; this is the sanctioned
 * escape for a house-ruled one: leave the guardrails and build it blank on the
 * Live Sheet, where nothing is enforced. Rendered in the WizShell action pill,
 * subordinate to the CTA — shown only while a gate is actively blocking.
 */

import type { CSSProperties } from 'react'
import { tokens } from '../index'
import '../../styles/cantina/wizard.css'

/** Static half; the colour, which brightens on hover, is `.su-wiz-off-rules`. */
const escapeStyle = {
  cursor: 'pointer',
  fontFamily: tokens.font.cond,
  fontSize: tokens.fontSize.badge,
  fontWeight: tokens.weight.semibold,
  letterSpacing: tokens.tracking.caps,
  textDecorationLine: 'underline',
  textDecorationStyle: 'dotted',
  textTransform: 'uppercase',
  textUnderlineOffset: '2px',
  whiteSpace: 'nowrap',
} satisfies CSSProperties satisfies CSSProperties

type OffRulesEscapeProps = {
  /** Leaves the guided flow for the blank Free-Edit path. */
  onEscape: () => void
}

export function OffRulesEscape({ onEscape }: OffRulesEscapeProps) {
  return (
    <button type="button" onClick={onEscape} className="su-wiz-off-rules" style={escapeStyle}>
      Off-rules build? Build it on the Live Sheet →
    </button>
  )
}
