/**
 * OffRulesEscape — the in-wizard exit to the Free-Edit Live Sheet (ADR-021,
 * P3.3). Guided Creation hard-gates an illegal build; this is the sanctioned
 * escape for a house-ruled one: leave the guardrails and build it blank on the
 * Live Sheet, where nothing is enforced. Rendered in the WizShell action pill,
 * subordinate to the CTA — shown only while a gate is actively blocking.
 */

type OffRulesEscapeProps = {
  /** Leaves the guided flow for the blank Free-Edit path. */
  onEscape: () => void
}

export function OffRulesEscape({ onEscape }: OffRulesEscapeProps) {
  return (
    <button
      type="button"
      onClick={onEscape}
      className="cursor-pointer whitespace-nowrap font-cond text-[11px] font-semibold uppercase tracking-caps text-su-white/70 underline decoration-dotted underline-offset-2 hover:text-su-white"
    >
      Off-rules build? Build it on the Live Sheet →
    </button>
  )
}
