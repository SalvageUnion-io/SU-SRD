import { PRODUCT } from '../../product'
import type { Story } from '../../stories/_harness'
import { BrandCard } from './BrandCard'

export default {
  title: 'Compositions/Brand Card',
}

/**
 * The SRD's default link preview, `apps/srd/public/og-image.png`: every page
 * without an entity card of its own. Shot at `--width page` to re-make it.
 */
export const Srd: Story = () => <BrandCard kicker="The Salvage Union SRD" />

/**
 * ITUN's default link preview, `apps/itun/public/og-image.png`: the Discord
 * banner's own kicker, since ITUN is the In the Union now app.
 */
export const Itun: Story = () => <BrandCard kicker={`You're ${PRODUCT.name}!`} />
