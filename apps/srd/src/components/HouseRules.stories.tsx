import { color, font } from 'component-lib/design/tokens'
import type { Story } from 'component-lib/stories/harness'
import { HouseRules } from './HouseRules'

export default { title: 'Compositions/House Rules' }

/**
 * The live registry, rendered through the same block the About page uses, so
 * the catalog shows the wording that ships.
 */
export const Default: Story = () => (
  // The body face and ink the About page sets around the block; both inherit.
  <div style={{ color: color.ink, fontFamily: font.body, maxWidth: '48rem' }}>
    <HouseRules />
  </div>
)
