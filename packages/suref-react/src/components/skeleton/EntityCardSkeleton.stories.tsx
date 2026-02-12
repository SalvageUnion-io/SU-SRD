import type { Story } from '@ladle/react'
import { EntityCardSkeleton } from './EntityCardSkeleton'

export default {
  title: 'Skeleton/EntityCardSkeleton',
}

export const Default: Story = () => (
  <div style={{ width: '400px' }}>
    <EntityCardSkeleton />
  </div>
)

export const Compact: Story = () => (
  <div style={{ width: '300px' }}>
    <EntityCardSkeleton compact />
  </div>
)

export const Multiple: Story = () => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', width: '400px' }}>
    <EntityCardSkeleton />
    <EntityCardSkeleton />
    <EntityCardSkeleton />
  </div>
)
