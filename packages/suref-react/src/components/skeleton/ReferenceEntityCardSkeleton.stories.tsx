import type { Story } from '@ladle/react'
import { ReferenceEntityCardSkeleton } from './ReferenceEntityCardSkeleton'

// biome-ignore lint/style/useComponentExportOnlyModules: Ladle stories require a default meta export alongside story components
export default {
  title: 'Containers/Card Skeleton',
}

export const Default: Story = () => (
  <div style={{ width: '400px' }}>
    <ReferenceEntityCardSkeleton />
  </div>
)

export const Compact: Story = () => (
  <div style={{ width: '300px' }}>
    <ReferenceEntityCardSkeleton compact />
  </div>
)

export const Multiple: Story = () => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', width: '400px' }}>
    <ReferenceEntityCardSkeleton />
    <ReferenceEntityCardSkeleton />
    <ReferenceEntityCardSkeleton />
  </div>
)
