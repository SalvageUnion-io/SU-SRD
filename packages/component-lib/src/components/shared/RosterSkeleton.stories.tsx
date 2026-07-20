import type { Story } from '@ladle/react'
import { Caption } from '../../stories/_harness'
import { RosterSkeleton } from './RosterSkeleton'

// biome-ignore lint/style/useComponentExportOnlyModules: Ladle stories require a default meta export alongside story components
export default {
  title: 'Containers/Roster Skeleton',
}

/** Roster loading placeholder — shown while IndexedDB hydrates. */
export const Default: Story = () => (
  <div className="bg-paper p-4">
    <Caption>RosterSkeleton</Caption>
    <RosterSkeleton />
  </div>
)
