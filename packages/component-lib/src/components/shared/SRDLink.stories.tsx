import type { Story } from '@ladle/react'
import { getEntitySlug, SalvageUnionReference } from 'salvageunion-reference'
import { SRDLink } from './SRDLink'

export default {
  title: 'Atoms/SRD Link',
}

const chassis = SalvageUnionReference.Chassis.all()[0]
const slug = chassis ? getEntitySlug(chassis) : 'iron-mongrel'
const name = chassis?.name ?? 'Iron Mongrel'
// The caller resolves the URL; ITUN builds this via its own `deepLinkTo`.
const href = `https://salvageunion.io/schema/chassis/item/${slug}`

/**
 * The cross-link ITUN renders in the foot band of every full entity card
 * (`srdEntityExternalLink`). The app resolves the SRD `href`; this component
 * owns only the new-tab presentation and the accessible label.
 */
export const Default: Story = () => (
  <div className="flex flex-col gap-4">
    <SRDLink
      href={href}
      entityName={name}
      className="text-pilot underline decoration-1 underline-offset-2 hover:opacity-70"
    />
    <SRDLink href={href} className="text-pilot underline decoration-1 underline-offset-2" />
  </div>
)
