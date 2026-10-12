import type { CSSProperties } from 'react'
import { color, space } from '../../design/tokens'
import type { Story } from '../../stories/_harness'
import { Caption } from '../../stories/_harness'
import { KvRow } from './KvRow'

export default {
  title: 'Atoms/Kv Row',
}

const FRAME = {
  backgroundColor: color.paper,
  maxWidth: '28rem',
  padding: space[32],
} satisfies CSSProperties

/** The review-recap definition list — fixed label rail, empty → muted "required". */
export const Default: Story = () => (
  <div style={FRAME}>
    <Caption>
      Build recap — a stack of KvRows. Empty values render the muted "required" placeholder; the
      last row self-clears its rule.
    </Caption>
    <div style={{ marginTop: space[12] }}>
      <KvRow label="Callsign" value="Ace" />
      <KvRow label="Class" value="Salvager" />
      <KvRow label="Motto" value="Nothing stays buried." />
      <KvRow label="Appearance" value={null} />
      <KvRow label="Keepsake" value={undefined} />
    </div>
  </div>
)
