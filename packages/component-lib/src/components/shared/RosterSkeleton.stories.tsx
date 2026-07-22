import type { Story } from '@ladle/react'
import { Caption } from '../../stories/_harness'
import { RosterSkeleton } from './RosterSkeleton'

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
