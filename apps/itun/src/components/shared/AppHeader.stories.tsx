import { color, space } from 'component-lib/design/tokens'
import type { Story } from 'component-lib/stories/harness'
import { Caption } from 'component-lib/stories/harness'
import type { CSSProperties } from 'react'
import '../../styles/screens.css'
import { AppHeader } from './AppHeader'

const FRAME = { backgroundColor: color.paper, padding: space[16] } satisfies CSSProperties

export default {
  title: 'Compositions/App Header',
}

/** The ITUN app chrome header — brand, nav, Buy the game and the mobile drawer. */
export const Default: Story = () => (
  <div style={FRAME}>
    <Caption>AppHeader</Caption>
    <AppHeader />
  </div>
)
