import type { Story } from '../../stories/_harness'
import { StartHere } from './StartHere'

export default { title: 'Compositions/StartHere' }

/** ITUN's front door: the steps alone, with nowhere to open yet. */
export const Default: Story = () => <StartHere id="start-here-default" />

/** The SRD's home: each step opens its creation guide, and the tool's way on follows. */
export const Linked: Story = () => (
  <StartHere
    id="start-here-linked"
    hrefs={{
      pilot: '/guides/create-a-pilot/',
      mech: '/guides/create-a-mech/',
      crawler: '/guides/create-a-crawler/',
    }}
  >
    <p>Ready to build? In the Union now turns these pages into a live sheet for your crew.</p>
  </StartHere>
)
