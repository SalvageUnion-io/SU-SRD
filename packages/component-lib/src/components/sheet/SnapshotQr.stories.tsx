import type { Story } from '@ladle/react'
import { Caption } from '../../stories/_harness'
import { SnapshotQr } from './SnapshotQr'

// biome-ignore lint/style/useComponentExportOnlyModules: Ladle stories require a default meta export alongside story components
export default {
  title: 'Atoms/Snapshot QR',
}

/** Encodes a share URL locally — no network, no external image service. */
export const Default: Story = () => (
  <div className="bg-paper p-4">
    <Caption>SnapshotQr</Caption>
    <SnapshotQr url="https://intheunionnow.com/s/example-snapshot" />
  </div>
)
