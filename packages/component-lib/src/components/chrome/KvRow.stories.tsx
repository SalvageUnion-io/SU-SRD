import type { Story } from '@ladle/react'
import { Caption } from '../../stories/_harness'
import { KvRow } from './KvRow'

// biome-ignore lint/style/useComponentExportOnlyModules: Ladle stories require a default meta export alongside story components
export default {
  title: 'Atoms/Kv Row',
}

/** The review-recap definition list — fixed label rail, empty → rust "required". */
export const Default: Story = () => (
  <div className="max-w-md bg-paper p-8">
    <Caption>
      Build recap — a stack of KvRows. Empty values render the rust "required" placeholder; the last
      row self-clears its rule.
    </Caption>
    <div className="mt-3">
      <KvRow label="Callsign" value="Ace" />
      <KvRow label="Class" value="Salvager" />
      <KvRow label="Motto" value="Nothing stays buried." />
      <KvRow label="Appearance" value={null} />
      <KvRow label="Keepsake" value={undefined} />
    </div>
  </div>
)
