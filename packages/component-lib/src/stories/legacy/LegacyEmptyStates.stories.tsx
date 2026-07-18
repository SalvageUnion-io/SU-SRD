import type { Story } from '@ladle/react'

import { Caption } from '../_harness'

/**
 * L1 "before" capture — the repeated dashed "nothing here" panel copied VERBATIM
 * from three ITUN surfaces. Each variant reproduces its source className + copy
 * exactly. They all duplicate the shared `EmptyState` container.
 */

// biome-ignore lint/style/useComponentExportOnlyModules: Ladle stories require a default meta export alongside story components
export default { title: 'Legacy/Empty State Blocks' }

export const Default: Story = () => (
  <div className="flex max-w-2xl flex-col gap-6">
    <div>
      <Caption>Roster FirstRunWelcome (Roster.tsx:410) · duplicates EmptyState</Caption>
      {/* FirstRunWelcome dashed panel, copied verbatim (icon/CTA omitted — frame is the point) */}
      <div className="mt-6 flex flex-col items-center gap-4 rounded-[3px] border-chrome border-dashed border-wk-faint p-8 text-center sm:p-12">
        <h2 className="font-cond text-xl font-bold uppercase tracking-widest text-rust">
          Welcome to In the Union Now
        </h2>
        <p className="max-w-prose font-body text-sm text-wk-muted">
          Build and run your Salvage Union crew — start with a pilot, kit them out with a mech, then
          anchor your crew to a Union Crawler.
        </p>
      </div>
    </div>

    <div>
      <Caption>ClassDetail empty (ClassStep.tsx:66) · duplicates EmptyState</Caption>
      {/* ClassDetail empty pane, copied verbatim */}
      <div className="flex h-full min-h-40 items-center justify-center rounded-[3px] border-chrome border-dashed border-wk-faint p-6 text-center text-sm text-wk-muted">
        Select a class to preview its ability trees.
      </div>
    </div>

    <div>
      <Caption>PatternList empty (PatternList.tsx:46) · duplicates EmptyState</Caption>
      {/* PatternList empty panel, copied verbatim */}
      <div className="rounded-[3px] border-chrome border-dashed border-wk-faint p-6 text-center">
        <p className="text-sm text-wk-muted">
          No patterns saved yet. Use &ldquo;Save as pattern&rdquo; from the mech builder to save a
          reusable template.
        </p>
      </div>
    </div>
  </div>
)
