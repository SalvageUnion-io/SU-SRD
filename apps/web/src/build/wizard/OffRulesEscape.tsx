/**
 * OffRulesEscape — the in-wizard exit to the Free-Edit Live Sheet (ADR-021,
 * P3.3). Guided Creation hard-gates an illegal build; this is the sanctioned
 * escape for a house-ruled one: leave the guardrails and build it blank on the
 * Live Sheet, where nothing is enforced. Rendered in the WizShell action pill,
 * subordinate to the CTA — shown only while a gate is actively blocking.
 */

import { Button, NextLabel } from '../../components/index'

type OffRulesEscapeProps = {
  /** Leaves the guided flow for the blank Free-Edit path. */
  onEscape: () => void
}

export function OffRulesEscape({ onEscape }: OffRulesEscapeProps) {
  return (
    // On the pill's line beside Cancel and the CTA, so their Full Size (§4.7);
    // outlined, under the CTA's rust.
    <Button variant="ghost" size="full" onClick={onEscape}>
      Off-rules build? <NextLabel to="Build it on the Live Sheet" size="mini" />
    </Button>
  )
}
