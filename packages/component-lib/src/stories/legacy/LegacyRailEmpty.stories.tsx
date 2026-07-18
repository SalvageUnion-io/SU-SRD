import type { Story } from '@ladle/react'
import { Bot } from 'lucide-react'

import { Caption } from '../_harness'

/**
 * L1 "before" capture — ITUN's `RailEmpty` dashed empty-slot card
 * (SheetRail.tsx:167), copied VERBATIM: the dashed ink frame, the ink role-tab
 * stamp, the tone glyph + helper message, and the dashed action foot. Rendered
 * in the mech tone context (`.sheet--mech`) with the mech variant's tinted fill,
 * glyph, and colors — exactly as the sheet supplies them.
 *
 * An EmptyState-adjacent but richer slot: the dashed frame + ink stamp tab
 * overlap what `EmptyState` and `Badge shape="stamp"` already provide.
 */

// biome-ignore lint/style/useComponentExportOnlyModules: Ladle stories require a default meta export alongside story components
export default { title: 'Legacy/Sheet Rail Empty' }

export const Default: Story = () => (
  <div className="flex max-w-sm flex-col gap-4">
    <Caption>
      RailEmpty (mech variant) · richer than EmptyState; dashed frame + ink stamp tab overlap
      EmptyState / Badge
    </Caption>
    {/* mech tone context supplies --tone-deep, as SheetMech does */}
    <div className="sheet--mech">
      {/* RailEmpty, copied verbatim from SheetRail.tsx:167 (mech: Bot glyph,
          RAIL_EMPTY_BG.mech fill, text-sheet-mech-deep icon color) */}
      <div
        className="flex min-w-0 flex-[1_1_0%] flex-col overflow-hidden rounded-[3px] border-2 border-dashed border-ink"
        style={{ background: 'oklch(from var(--color-mech) 0.965 0.028 h)' }}
      >
        <span className="self-start bg-ink px-2 pb-0.5 pt-[3px] font-cond text-label-lg font-bold uppercase leading-none tracking-caps-wide text-paper">
          ASSIGNED MECH
        </span>
        <div className="flex flex-wrap items-center gap-3 px-2.5 py-2">
          {/* Missing-entity glyph in the entity's own tone (U-6, decorative). */}
          <Bot aria-hidden="true" className="size-6 shrink-0 text-sheet-mech-deep" />
          <p
            className="m-0 min-w-[140px] flex-1 font-body text-note leading-snug"
            style={{ color: 'var(--tone-deep)' }}
          >
            No mech in the bay — dock one to track it here.
          </p>
        </div>
        <div className="mt-auto flex items-stretch gap-2 border-t-2 border-dashed border-ink px-2.5 py-1.5 *:flex-1">
          <span className="inline-flex items-center justify-center rounded-[3px] border-chrome border-ink bg-paper px-2 py-1 font-cond text-label-lg font-bold uppercase leading-none tracking-caps-wide text-ink">
            Build a mech
          </span>
          <span className="inline-flex items-center justify-center rounded-[3px] border-chrome border-ink bg-paper px-2 py-1 font-cond text-label-lg font-bold uppercase leading-none tracking-caps-wide text-ink">
            Link existing
          </span>
        </div>
      </div>
    </div>
  </div>
)
