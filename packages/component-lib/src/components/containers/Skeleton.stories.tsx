import type { Story } from '../../stories/_harness'
import { Caption } from '../../stories/_harness'
import { Skeleton } from './Skeleton'

export default {
  title: 'Containers/Skeleton',
}

/** Mirrors the compact Card anatomy (frame / band / body). */
export const Default: Story = () => (
  <div style={{ width: 300 }}>
    <Caption>frame + band + body ghosts · the medium-card density</Caption>
    <Skeleton />
  </div>
)
