import { color, space } from '../../design/tokens'
import type { Story } from '../../stories/_harness'
import { Caption } from '../../stories/_harness'
import { RosterSkeleton } from './RosterSkeleton'

export default {
  title: 'Containers/Roster Skeleton',
}

/** Roster loading placeholder — shown while IndexedDB hydrates. */
export const Default: Story = () => (
  <div style={{ backgroundColor: color.paper, padding: space[16] }}>
    <Caption>RosterSkeleton</Caption>
    <RosterSkeleton />
  </div>
)
