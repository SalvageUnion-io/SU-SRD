import type { Story } from '@ladle/react'
import type { ReactNode } from 'react'
import { PageHeading } from './PageHeading'

// biome-ignore lint/style/useComponentExportOnlyModules: Ladle stories require a default meta export alongside story components
export default {
  title: 'Atoms/Page Heading',
}

function Cluster({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <div className="mb-1.5 font-cond text-label uppercase tracking-caps text-wk-muted">
        {label}
      </div>
      {children}
    </div>
  )
}

/** `PageHeading` — the ink stamp band (default) and its quieter `subheading`
 *  variant, the page-level heading language shared across the reference pages. */
export const Default: Story = () => (
  <div className="flex flex-col gap-6">
    <Cluster label="heading (default) — the ink stamp band">
      <PageHeading>About the Salvage Union SRD</PageHeading>
    </Cluster>
    <Cluster label="heading — centered per-page modifier">
      <PageHeading className="text-center">JSON API Reference</PageHeading>
    </Cluster>
    <Cluster label="subheading — the section head">
      <PageHeading variant="subheading">Available Schemas</PageHeading>
    </Cluster>
  </div>
)
