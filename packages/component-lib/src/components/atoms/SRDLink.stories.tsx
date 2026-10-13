import { getEntitySlug, SalvageUnionReference } from 'salvageunion-reference'
import { space } from '../../design/tokens'
import type { Story } from '../../stories/_harness'
import '../../stories/_stories.css'
import { SRDLink } from './SRDLink'

export default {
  title: 'Atoms/SRD Link',
}

const chassis = SalvageUnionReference.Chassis.all()[0]
const slug = chassis ? getEntitySlug(chassis) : 'iron-mongrel'
const name = chassis?.name ?? 'Iron Mongrel'
// The caller resolves the URL; ITUN builds this via its own `deepLinkTo`.
const href = `https://salvageunion.io/chassis/${slug}`

/**
 * The cross-link ITUN renders in the foot band of every full entity card
 * (`srdEntityExternalLink`). The app resolves the SRD `href`; this component
 * owns only the new-tab presentation and the accessible label.
 */
export const Default: Story = () => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: space[16] }}>
    <SRDLink href={href} entityName={name} className="su-story-srd-link su-story-srd-link--hover" />
    <SRDLink href={href} className="su-story-srd-link" />
  </div>
)
