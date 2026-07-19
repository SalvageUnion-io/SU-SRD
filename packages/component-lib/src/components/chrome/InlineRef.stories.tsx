import type { Story } from '@ladle/react'
import { SalvageUnionReference } from 'salvageunion-reference'

import { InlineRef } from './InlineRef'

// biome-ignore lint/style/useComponentExportOnlyModules: Ladle stories require a default meta export alongside story components
export default {
  title: 'Atoms/Inline Ref',
}

// A real SRD system drives the resolved reference + its slug href.
const system = SalvageUnionReference.Systems.all()[0]
const systemName = system?.name ?? '30mm Autocannon'
const systemSlug = systemName
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-|-$/g, '')
const systemHref = `/systems/${systemSlug}`

/** Resolved vs unresolved references, in prose and standalone — on one page. */
export const Default: Story = () => (
  <div className="flex flex-col gap-5 bg-paper p-5 text-ink">
    <p className="max-w-2xl font-body text-xs leading-relaxed text-ink-2">
      An in-prose entity reference: resolved (rust border, a real keyboard-reachable link) or
      unresolved (ink dashed border, inert — only summons a tooltip).
    </p>
    <div className="max-w-md font-body text-sm">
      Mount a{' '}
      <InlineRef resolved href={systemHref} title={`${systemName} — resolved`}>
        {systemName}
      </InlineRef>{' '}
      for close work, or an{' '}
      <InlineRef title="Unresolved — summons a tooltip">unresolved Widget</InlineRef> if the
      reference can&apos;t be found.
    </div>
    <div className="flex flex-wrap items-start gap-6 font-body text-sm">
      <div className="flex flex-col gap-1.5">
        <InlineRef resolved href={systemHref} title={systemName}>
          {systemName}
        </InlineRef>
        <code className="font-body text-nano text-ink-2">resolved</code>
      </div>
      <div className="flex flex-col gap-1.5">
        <InlineRef title="No such entity">Phantom System</InlineRef>
        <code className="font-body text-nano text-ink-2">unresolved</code>
      </div>
    </div>
  </div>
)
