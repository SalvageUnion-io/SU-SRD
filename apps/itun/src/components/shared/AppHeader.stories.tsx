import type { Story } from 'component-lib/stories/harness'
import { Caption } from 'component-lib/stories/harness'
import { AppHeader } from './AppHeader'

export default {
  title: 'Compositions/App Header',
}

/** The ITUN app chrome header — brand, nav, Buy the game and the mobile drawer. */
export const Default: Story = () => (
  <div className="bg-paper p-4">
    <Caption>AppHeader</Caption>
    <AppHeader />
  </div>
)
