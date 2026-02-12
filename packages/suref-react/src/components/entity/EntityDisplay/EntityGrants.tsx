import type { SURefObjectGrant, SURefEnumSchemaName, SURefEntity } from 'salvageunion-reference'
import { getGrants, getModel } from 'salvageunion-reference'
import { EntityDisplay } from './index'
import { EntitySubheader } from './EntitySubheader'
import { useEntityDisplayContext } from './useEntityDisplayContext'
import { cn } from '../../../utils/cn'

export function EntityGrants() {
  const { data, spacing } = useEntityDisplayContext()

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
    <div className={cn(spacing.smallSpaceYClass)}>
      <div style={{ marginBottom: `${spacing.minimalGap}rem` }}>
        <EntitySubheader disabled={true} label="Grants:" />
      </div>
      <div style={{ marginTop: `${spacing.contentPadding}rem` }} className="space-y-2">
        {grantedEntities.map((entity, idx) => (
          <EntityDisplay
            key={idx}
            hideActions
            data={entity}
            compact
            collapsible
            defaultExpanded={false}
          />
        ))}
      </div>
    </div>
  )
}
