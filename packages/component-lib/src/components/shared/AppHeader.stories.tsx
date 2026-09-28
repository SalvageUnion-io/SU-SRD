import type { Story } from '../../stories/_harness'
import { Caption } from '../../stories/_harness'
import { AppHeader } from './AppHeader'

export default {
  title: 'Compositions/App Header',
}

/** The app chrome header — brand, nav drawer, and the search affordance. */
export const Default: Story = () => (
  <div className="bg-paper p-4">
    <Caption>AppHeader</Caption>
    <AppHeader onSearchClick={() => {}} />
  </div>
)
