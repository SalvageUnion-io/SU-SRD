import type { Story } from '@ladle/react'
import { SalvageUnionReference } from 'salvageunion-reference'

import { InlineRef } from '../../components/chrome/InlineRef'

// biome-ignore lint/style/useComponentExportOnlyModules: Ladle stories require a default meta export alongside story components
export default {
  title: 'Atoms/InlineRef',
}

// A real SRD system drives the resolved reference + its slug href.
const system = SalvageUnionReference.Systems.all()[0]
const systemName = system?.name ?? '30mm Autocannon'
const systemSlug = systemName
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-|-$/g, '')
const systemHref = `/systems/${systemSlug}`

/** In-prose references: resolved (rust, navigates) vs unresolved (ink dashed). */
export const InProse: Story = () => (
  <div className="max-w-md bg-paper p-4 font-body text-sm text-ink">
    Mount a{' '}
    <InlineRef resolved href={systemHref} title={`${systemName} — resolved`}>
      {systemName}
    </InlineRef>{' '}
    for close work, or an{' '}
    <InlineRef title="Unresolved — summons a tooltip">unresolved Widget</InlineRef> if the reference
    can&apos;t be found.
  </div>
)

/** Resolved — rust border, a real keyboard-reachable link. */
export const Resolved: Story = () => (
  <div className="bg-paper p-4 font-body text-sm text-ink">
    <InlineRef resolved href={systemHref} title={systemName}>
      {systemName}
    </InlineRef>
  </div>
)

/** Unresolved — ink dashed border, inert; only summons the tooltip. */
export const Unresolved: Story = () => (
  <div className="bg-paper p-4 font-body text-sm text-ink">
    <InlineRef title="No such entity">Phantom System</InlineRef>
  </div>
)
