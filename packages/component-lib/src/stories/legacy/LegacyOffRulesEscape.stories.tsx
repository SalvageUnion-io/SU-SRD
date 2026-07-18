import type { Story } from '@ladle/react'
import { Caption } from '../_harness'

// biome-ignore lint/style/useComponentExportOnlyModules: Ladle stories require a default meta export alongside story components
export default { title: 'Legacy/Off Rules Escape' }

/**
 * Verbatim reproduction of the in-wizard escape link from
 * apps/in-the-union-now/src/components/wizard/OffRulesEscape.tsx (lines 14-24):
 * a bare dotted-underline `text-paper/70` condensed-caps button that sits in the
 * WizShell action pill (over a dark tone band) while a gate is actively
 * blocking, offering the Free-Edit Live Sheet exit (ADR-021 P3.3). ITUN's
 * `onEscape` handler is inlined here as a no-op.
 */
function LegacyOffRulesEscape({ onEscape }: { onEscape: () => void }) {
  return (
    <button
      type="button"
      onClick={onEscape}
      className="cursor-pointer whitespace-nowrap font-cond text-[11px] font-semibold uppercase tracking-caps text-paper/70 underline decoration-dotted underline-offset-2 hover:text-paper"
    >
      Off-rules build? Build it on the Live Sheet →
    </button>
  )
}

export const Default: Story = () => (
  <div className="flex flex-col gap-4">
    <Caption>
      Legacy · in-wizard Off-rules escape link (ITUN OffRulesEscape) — a dotted-underline
      condensed-caps button shown over the WizShell action pill's dark tone band while a gate blocks
      the build. Framed on the tone band below so the paper/70 link is legible.
    </Caption>

    {/* The link lives over a dark WizShell tone band — framed here on ink so the
        paper/70 treatment reads as it does in the wizard, not on the story's paper canvas. */}
    <div className="w-fit rounded-[3px] bg-ink px-5 py-3">
      <LegacyOffRulesEscape onEscape={() => {}} />
    </div>
  </div>
)
