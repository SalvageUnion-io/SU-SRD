import type { SURefEntity } from 'salvageunion-reference'
import { resolveGrantedEntities } from 'salvageunion-reference'
import { ReferenceEntityDisplay } from './index'
import { SectionSeparator } from './SectionSeparator'
import { useEntityHref } from './entityHrefContext'
import type { ReferenceEntityControl } from './referenceEntityControlTypes'
import { cn } from '../../../utils/cn'
import type { getReferenceEntitySpacing } from './referenceEntityDisplayTypes'
import { useDisplaySpacing } from './displayStateContext'

type ReferenceEntityGrantsProps = {
  data: SURefEntity
  /** Optional override; falls back to the card display-state context. */
  spacing?: ReturnType<typeof getReferenceEntitySpacing>
  compact?: boolean
  /**
   * Render granted entities as full compact cards even when the granting ability
   * is itself compact — instead of collapsing them to a header-only listing. Used
   * by the ITUN live sheet so a granting ability (e.g. Auto-Turret) shows the
   * granted equipment as a proper entity display (stats, content, resolved row,
   * and its choice cards), the same way it renders on its own reference page.
   * Default false — dense compact listings (search, reference index) stay terse.
   */
  expand?: boolean
}

export function ReferenceEntityGrants({
  data,
  spacing: spacingProp,
  compact,
  expand,
}: ReferenceEntityGrantsProps) {
  const spacing = useDisplaySpacing(spacingProp, compact ?? false)
  // Shared resolver (single source of truth — see salvageunion-reference).
  const grantedEntities = resolveGrantedEntities(data)

  if (grantedEntities.length === 0) {
    return null
  }

  return (
    <div className={cn('flex flex-col', spacing.sectionSpaceYClass)}>
      {/* `Grants` divider matches the `Actions` divider exactly (SectionSeparator). */}
      <SectionSeparator
        label="Grants"
        compact={compact}
        fontSize={compact ? 'text-xs' : 'text-sm'}
      />
      <div className={cn('flex flex-col', spacing.smallSpaceYClass)}>
        {grantedEntities.map((entity, idx) => (
          // id + index: stable, and unique even for an intentional double-grant
          // (e.g. Mecha Packmaster grants two Mecha Companions).
          <GrantedEntityListing
            // biome-ignore lint/suspicious/noArrayIndexKey: static grant list; index disambiguates duplicate granted ids
            key={`${entity.id}-${idx}`}
            entity={entity}
            parentCompact={!!compact}
            expand={!!expand}
          />
        ))}
      </div>
    </div>
  )
}

function GrantedEntityListing({
  entity,
  parentCompact,
  expand,
}: {
  entity: SURefEntity
  parentCompact: boolean
  expand: boolean
}) {
  const name = 'name' in entity && typeof entity.name === 'string' ? entity.name : 'entity'
  // Href comes from the app-provided builder (route-agnostic); no provider →
  // no link → no View Details control.
  const href = useEntityHref(entity)

  // A visible "View Details" control (not a cardClick) opens the entity's show
  // page in a new tab. Because the card is no longer whole-card-clickable, it no
  // longer enlarges on hover — the nested card stays put.
  const controls: ReferenceEntityControl[] | undefined = href
    ? [
        {
          key: 'view-details',
          label: 'View Details',
          ariaLabel: `View ${name} details`,
          onClick: () => window.open(href, '_blank', 'noopener,noreferrer'),
        },
      ]
    : undefined

  // When the granting ability itself is shown compact (in lists / nested
  // contexts), collapse the granted entity to header-only — its name + resolved
  // stat row in the header, no body. When the ability is shown full — or a compact
  // caller opts in via `expand` (the ITUN live sheet) — the nested equipment
  // renders as a full card (intro content + resolved row + choice cards), the same
  // way it renders on its own reference page. The `lead` intro block is hidden
  // here (`hideLeadContent`) — it shows on the equipment's own page but is
  // redundant with the ability's description in a grant. Actions are hidden (the
  // same-named pilot-equipment action lives on the ability).
  return (
    <ReferenceEntityDisplay
      hide={{ actions: true }}
      hideLeadContent
      data={entity}
      compact
      listing={expand ? false : parentCompact}
      controls={controls}
    />
  )
}
