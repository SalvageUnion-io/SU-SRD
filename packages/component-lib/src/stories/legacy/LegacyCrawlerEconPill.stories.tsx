import type { Story } from '@ladle/react'

import { Caption } from '../_harness'

/**
 * L1 "before" capture — the inline `.lact` action chip from CrawlerEcon's
 * economy lozenge (CrawlerEcon.tsx:94), copied VERBATIM. It uses `var(--tone-deep)`
 * as its fill, so it's wrapped in the crawler tone context (`.sheet--crawler`)
 * exactly as the crawler sheet supplies it. Duplicates `Pill` / `Badge shape="chip"`.
 */

// biome-ignore lint/style/useComponentExportOnlyModules: Ladle stories require a default meta export alongside story components
export default { title: 'Legacy/Crawler Econ Pill' }

export const Default: Story = () => (
  <div className="flex max-w-md flex-col gap-4">
    <Caption>CrawlerEcon .lact action chip · duplicates Pill / Badge shape="chip"</Caption>
    {/* Crawler tone context supplies --tone-deep (magenta), as SheetCrawler does */}
    <div className="sheet--crawler">
      {/* .lact action chip, copied verbatim from CrawlerEcon.tsx:94 */}
      <span
        className="mt-1 inline-flex items-center rounded-[2px] px-2 py-[3px] font-cond text-[9px] font-bold uppercase tracking-[0.16em] text-paper"
        style={{ background: 'var(--tone-deep)' }}
      >
        Pay Upkeep
      </span>
    </div>
  </div>
)
