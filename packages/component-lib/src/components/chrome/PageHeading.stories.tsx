import type { ReactNode } from 'react'
import type { Story } from '../../stories/_harness'
import { PageHeading } from './PageHeading'

export default {
  title: 'Atoms/Page Heading',
}

function Cluster({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <div className="mb-1.5 font-cond text-badge uppercase tracking-caps text-wk-muted">
        {label}
      </div>
      {children}
    </div>
  )
}

/** `PageHeading` — the in-page heading rungs under a page's `ChapterBand`: the
 *  condensed-caps `subheading` (default) and the quieter in-panel `section`. */
export const Default: Story = () => (
  <div className="flex flex-col gap-6">
    <Cluster label="subheading (default) — the section head">
      <PageHeading>Available Schemas</PageHeading>
    </Cluster>
    <Cluster label="section — the in-panel head">
      <PageHeading variant="section">Abilities</PageHeading>
    </Cluster>
  </div>
)
