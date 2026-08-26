/*
 * No story file — context, and one of three link providers whose effect is
 * behavioural rather than visual: it changes what a "View details" control DOES
 * (new-tab navigation vs an in-place modal), not how anything looks. Verified —
 * a before/after pair rendered pixel-identical.
 *
 * So the card shows the real composition once and states the switch in its
 * caption. (`EntityHrefProvider` and `PatternHrefProvider` are documented the
 * same way; `EntityExternalLinkProvider` is the one whose effect IS visible,
 * and its card shows a true before/after.)
 */
import { EntityDetailLinkProvider, EntityHrefProvider, ReferenceEntityCard } from 'component-lib'
import { SalvageUnionReference } from 'salvageunion-reference'
import { Caption } from '../preview-lib/harness'

const href = (e: { schemaName?: string; name: string }) =>
  `https://salvageunion.io/schema/${e.schemaName ?? 'systems'}/item/${e.name
    .toLowerCase()
    .replace(/\s+/g, '-')}`

/**
 * Opts nested "View details" controls into opening the entity's show page in a
 * new tab — via the `EntityHrefProvider` builder — instead of the in-place
 * modal. The SRD, a navigable reference site, sets this; ITUN leaves it `false`
 * so its detail view stays an in-app modal.
 *
 * Needs an `EntityHrefProvider` above it to have anywhere to send the reader.
 */
export function NewTabDetails() {
  const system = SalvageUnionReference.Systems.all()[0]
  if (!system) return null
  return (
    <div className="flex max-w-xl flex-col gap-4 bg-paper p-4">
      <Caption>
        value=true — &quot;View details&quot; navigates out instead of opening the modal
      </Caption>
      <EntityHrefProvider value={href}>
        <EntityDetailLinkProvider value>
          <ReferenceEntityCard data={system} />
        </EntityDetailLinkProvider>
      </EntityHrefProvider>
    </div>
  )
}
