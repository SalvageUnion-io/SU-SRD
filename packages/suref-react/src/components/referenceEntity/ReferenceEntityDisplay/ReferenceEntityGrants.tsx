import type { SURefObjectGrant, SURefEnumSchemaName, SURefEntity } from 'salvageunion-reference'
import { getGrants, getModel } from 'salvageunion-reference'
import { ReferenceEntityDisplay } from './index'
import { SectionSeparator } from './SectionSeparator'
import { getEntityDetailHref } from './entityDetailHref'
import type { ReferenceEntityControl } from './referenceEntityControlTypes'
import { cn } from '../../../utils/cn'
import type { getReferenceEntitySpacing } from './referenceEntityDisplayTypes'

type ReferenceEntityGrantsProps = {
  data: SURefEntity
  spacing: ReturnType<typeof getReferenceEntitySpacing>
  compact?: boolean
}

export function ReferenceEntityGrants({ data, spacing, compact }: ReferenceEntityGrantsProps) {
  // Get grants from entity
  const entityGrants = getGrants(data) || []

  if (entityGrants.length === 0) {
    return null
  }

  // Resolve granted entities
  const grantedEntities = entityGrants
    .map((grant: SURefObjectGrant) => {
      // Skip 'choice' schema grants as they're handled separately
      if (grant.schema === 'choice') {
        return null
      }

      const schema = grant.schema as SURefEnumSchemaName
      const model = getModel(schema.toLowerCase())
      if (!model) return null

      const entity = model.find((e: SURefEntity) => e.name === grant.name)
      return entity || null
    })
    .filter((entity): entity is SURefEntity & { schemaName: string } => entity !== null)

  if (grantedEntities.length === 0) {
    return null
  }

  return (
    <div className={cn('flex flex-col', spacing.sectionSpaceYClass)}>
      {/* `Grants` divider matches the `Actions` divider exactly (SectionSeparator). */}
      <SectionSeparator label="Grants" compact={compact} />
      <div className={cn('flex flex-col', spacing.smallSpaceYClass)}>
        {grantedEntities.map((entity, idx) => (
          <GrantedEntityListing key={idx} entity={entity} />
        ))}
      </div>
    </div>
  )
}

function GrantedEntityListing({ entity }: { entity: SURefEntity }) {
  const name = 'name' in entity && typeof entity.name === 'string' ? entity.name : 'entity'
  const href = getEntityDetailHref(entity)

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

  return (
    /* Full nested compact equipment (not header-only listing): its intro
       paragraph, the resolved dataview row + choice cards all render inside its
       body. Actions are hidden (the redundant same-named pilot-equipment action
       lives on the granting ability, not duplicated here). */
    <ReferenceEntityDisplay hide={{ actions: true }} data={entity} compact controls={controls} />
  )
}
