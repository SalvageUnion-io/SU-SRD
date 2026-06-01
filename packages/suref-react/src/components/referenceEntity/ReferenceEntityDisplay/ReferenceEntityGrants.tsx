import type { SURefObjectGrant, SURefEnumSchemaName, SURefEntity } from 'salvageunion-reference'
import { getGrants, getModel } from 'salvageunion-reference'
import { ReferenceEntityDisplay } from './index'
import { SectionSeparator } from './SectionSeparator'
import { useDetailModal } from './useDetailModal'
import { cn } from '../../../utils/cn'
import type { getReferenceEntitySpacing } from './referenceEntityDisplayTypes'

type ReferenceEntityGrantsProps = {
  data: SURefEntity
  spacing: ReturnType<typeof getReferenceEntitySpacing>
  compact?: boolean
  /**
   * When set, the nested equipment hides its own content (the lead paragraph),
   * because the granting ability already rendered the lead line once above the
   * `Grants` divider (§8.2 de-duplication).
   */
  suppressLead?: boolean
}

export function ReferenceEntityGrants({
  data,
  spacing,
  compact,
  suppressLead,
}: ReferenceEntityGrantsProps) {
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
          <GrantedEntityListing key={idx} entity={entity} suppressLead={suppressLead} />
        ))}
      </div>
    </div>
  )
}

function GrantedEntityListing({
  entity,
  suppressLead,
}: {
  entity: SURefEntity
  suppressLead?: boolean
}) {
  const detailModal = useDetailModal(entity)

  return (
    <>
      {/* Full nested compact equipment (not header-only listing): the resolved
          dataview row + choice cards render inside its body. `hide.content`
          suppresses the lead paragraph (already shown once by the ability);
          the resolved row + cards are independent of `hide.content`. */}
      <ReferenceEntityDisplay
        hide={{ actions: true, content: !!suppressLead }}
        data={entity}
        compact
        controls={[detailModal.control]}
      />
      {detailModal.modal}
    </>
  )
}
