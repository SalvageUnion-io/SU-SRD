import {
  getSchemaCatalog,
  SalvageUnionReference,
  getModel,
  getEntitySchemas,
  getReferenceEntityData,
} from 'salvageunion-reference'
import type { SURefEnumSchemaName, SURefEntity } from 'salvageunion-reference'

const catalog = getSchemaCatalog()

export function getSchemaStaticPaths() {
  return getEntitySchemas().map((schema) => {
    const model = getModel(schema.id)
    const data = model ? (model.all() as SURefEntity[]) : []
    return {
      params: { schemaId: schema.id },
      props: {
        schema,
        data,
      },
    }
  })
}

export function getItemStaticPaths() {
  const paths: {
    params: { schemaId: string; itemId: string }
    props: {
      item: SURefEntity
      schema: (typeof catalog.schemas)[number]
      itemName: string
      itemDescription: string
    }
  }[] = []

  for (const schema of catalog.schemas) {
    try {
      const items = SalvageUnionReference.findAllIn(schema.id as SURefEnumSchemaName, () => true)
      for (const item of items) {
        if ('id' in item && item.id) {
          const displayData = getReferenceEntityData(item)

          paths.push({
            params: { schemaId: schema.id, itemId: displayData.slug },
            props: {
              item,
              schema,
              itemName: displayData.name,
              itemDescription: displayData.description ?? '',
            },
          })
        }
      }
    } catch {
      // Skip schemas that can't be loaded
    }
  }

  return paths
}
