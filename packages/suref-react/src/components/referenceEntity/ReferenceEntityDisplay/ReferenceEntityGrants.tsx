import type { SURefObjectGrant, SURefEnumSchemaName, SURefEntity } from 'salvageunion-reference'
import { getGrants, getModel } from 'salvageunion-reference'
import { ReferenceEntityDisplay } from './index'
import { ReferenceEntitySubheader } from './ReferenceEntitySubheader'
import { useDetailModal } from './useDetailModal'
import { cn } from '../../../utils/cn'
import type { getReferenceEntitySpacing } from './referenceEntityDisplayTypes'

type ReferenceEntityGrantsProps = {
  data: SURefEntity
  spacing: ReturnType<typeof getReferenceEntitySpacing>
}

export function ReferenceEntityGrants({ data, spacing }: ReferenceEntityGrantsProps) {
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
    <div className={cn(spacing.sectionSpaceYClass)}>
      <ReferenceEntitySubheader disabled={true} label="Grants:" />
      <div className={cn(spacing.smallSpaceYClass)}>
        {grantedEntities.map((entity, idx) => (
          <GrantedEntityListing key={idx} entity={entity} />
        ))}
      </div>
    </div>
  )
}

function GrantedEntityListing({ entity }: { entity: SURefEntity }) {
  const detailModal = useDetailModal(entity)

  return (
    <>
      <ReferenceEntityDisplay
        hide={{ actions: true }}
        data={entity}
        compact
        listing
        controls={[detailModal.control]}
      />
      {detailModal.modal}
    </>
  )
}
