/* Ported from packages/component-lib/src/components/shared/SRDLink.stories.tsx. */
import { SRDLink } from 'component-lib'
import { getEntitySlug, SalvageUnionReference } from 'salvageunion-reference'
import { Group, Stack } from '../preview-lib/harness'

/**
 * The cross-link ITUN renders in the foot band of every full entity card. The
 * app resolves the SRD `href` (via its own `deepLinkTo`); this component owns
 * only the new-tab presentation and the accessible label.
 */
export function Named() {
  const chassis = SalvageUnionReference.Chassis.all()[0]
  const slug = chassis ? getEntitySlug(chassis) : 'iron-mongrel'
  const href = `https://salvageunion.io/schema/chassis/item/${slug}`
  return (
    <div className="flex flex-col gap-4 bg-paper p-4">
      <Group caption="with an entityName — the accessible label names the target">
        <SRDLink
          href={href}
          entityName={chassis?.name ?? 'Iron Mongrel'}
          className="text-pilot underline decoration-1 underline-offset-2 hover:opacity-70"
        />
      </Group>
      <Group caption="without — the generic label">
        <SRDLink href={href} className="text-pilot underline decoration-1 underline-offset-2" />
      </Group>
    </div>
  )
}
