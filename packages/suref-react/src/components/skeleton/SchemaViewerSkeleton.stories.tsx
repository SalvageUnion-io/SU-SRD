import type { Story } from '@ladle/react'
import { SchemaViewerSkeleton } from './SchemaViewerSkeleton'

export default {
  title: 'Skeleton/SchemaViewerSkeleton',
}

export const Default: Story = () => (
  <div style={{ width: '100%' }}>
    <SchemaViewerSkeleton />
  </div>
)
