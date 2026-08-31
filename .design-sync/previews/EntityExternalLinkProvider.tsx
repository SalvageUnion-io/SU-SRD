/*
 * No story file — context. Shown as a before/after on a FULL card, because the
 * foot band is the only place the cross-link renders.
 */
import { EntityExternalLinkProvider, ReferenceEntityCard, SRDLink } from 'component-lib'
import { SalvageUnionReference } from 'salvageunion-reference'
import { Group } from '../preview-lib/harness'

/**
 * Provides an app-specific external cross-link builder — ITUN's "View in SRD →"
 * deep link out to the reference site. FULL entity cards render it in their foot
 * band; return `undefined` for entities with no external page. The SRD, which
 * *is* the SRD, provides no builder, so nothing renders there.
 */
export function FootBandLink() {
  const system = SalvageUnionReference.Systems.all()[0]
  if (!system) return null
  const build = (entity: { name: string }) => (
    <SRDLink
      href={`https://salvageunion.io/schema/systems/item/${entity.name
        .toLowerCase()
        .replace(/\s+/g, '-')}`}
      entityName={entity.name}
      className="text-pilot underline decoration-1 underline-offset-2"
    />
  )
  return (
    <div className="flex max-w-xl flex-col gap-6 bg-paper p-4">
      <Group caption="no builder — the foot band carries no cross-link">
        <ReferenceEntityCard data={system} />
      </Group>
      <Group caption="with a builder — the cross-link appears in the foot band">
        <EntityExternalLinkProvider value={build}>
          <ReferenceEntityCard data={system} />
        </EntityExternalLinkProvider>
      </Group>
    </div>
  )
}
