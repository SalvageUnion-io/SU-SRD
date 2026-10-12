import { color, font } from '../../design/tokens'
import type { Story } from '../../stories/_harness'
import { HouseRules } from './HouseRules'

export default { title: 'Compositions/House Rules' }

/**
 * The live registry, rendered through the same block both about pages use, so
 * the catalog shows the wording that ships.
 */
export const Default: Story = () => (
  // The body face and ink an app's about page sets around the block; both inherit.
  <div style={{ color: color.ink, fontFamily: font.body, maxWidth: '48rem' }}>
    <HouseRules />
  </div>
)
