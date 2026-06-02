import type { SURefEntity } from 'salvageunion-reference'
import { resolveGrantedEntities } from 'salvageunion-reference'
import { ReferenceEntityDisplay } from './index'
import { SectionSeparator } from './SectionSeparator'
import { useEntityHref } from './entityHrefContext'
import type { ReferenceEntityControl } from './referenceEntityControlTypes'
import { cn } from '../../../utils/cn'
import type { getReferenceEntitySpacing } from './referenceEntityDisplayTypes'

type ReferenceEntityGrantsProps = {
  data: SURefEntity
  spacing: ReturnType<typeof getReferenceEntitySpacing>
  compact?: boolean
}

export function ReferenceEntityGrants({ data, spacing, compact }: ReferenceEntityGrantsProps) {
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
            key={`${entity.id}-${idx}`}
            entity={entity}
            parentCompact={!!compact}
          />
        ))}
      </div>
    </div>
  )
}

function GrantedEntityListing({
  entity,
  parentCompact,
}: {
  entity: SURefEntity
  parentCompact: boolean
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
  // stat row in the header, no body. When the ability is shown full, the nested
  // equipment expands (intro + resolved row + choice cards). Actions are hidden
  // (the redundant same-named pilot-equipment action lives on the ability).
  return (
    <ReferenceEntityDisplay
      hide={{ actions: true }}
      data={entity}
      compact
      listing={parentCompact}
      controls={controls}
    />
  )
}
