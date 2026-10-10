import type { CSSProperties } from 'react'
import { space } from '../../../design/tokens'
import type { Story } from '../../../stories/_harness'
import { Caption } from '../../../stories/_harness'
import { UserMadeStamp } from './UserMadeStamp'

export default {
  title: 'Atoms/User Made Stamp',
}

const STACK = { display: 'flex', flexDirection: 'column', gap: space[16] } satisfies CSSProperties

const ROW = { alignItems: 'center', display: 'flex', gap: space[12] } satisfies CSSProperties

/**
 * The dashed User-made stamp (ruleset §3.9, issue 1276). On a card it rides the
 * seam and says "User-made"; on a full user-made page it leads the title and
 * names what the thing is. Hover either for what it means.
 */
export const Default: Story = () => (
  <div style={STACK}>
    <div style={ROW}>
      <Caption>On a card&rsquo;s seam</Caption>
      <UserMadeStamp />
    </div>
    <div style={ROW}>
      <Caption>Leading a page title</Caption>
      <UserMadeStamp label="User-made pattern" />
    </div>
  </div>
)
