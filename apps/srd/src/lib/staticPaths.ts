import {
  getSchemaCatalog,
  SalvageUnionReference,
  getModel,
  getEntitySchemas,
  getReferenceEntityData,
} from './gameData'
import type { SURefEnumSchemaName, SURefEntity } from 'salvageunion-reference'

const catalog = getSchemaCatalog()

export function getSchemaStaticPaths() {
  return getEntitySchemas().map((schema) => {
    const model = getModel(schema.id)
    const data: SURefEntity[] = model ? model.all() : []
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

  // Entity schemas only — meta schemas (actions, ability-tree-requirements,
  // catalog-categories) have no /schema/<id>/ listing page (see
  // getSchemaStaticPaths above), so item pages for them would be sitemap
  // orphans with 404 breadcrumbs. Their content renders inline on the pages
  // of the entities that own it.
  for (const schema of catalog.schemas.filter((s) => !s.meta)) {
    try {
      const items = SalvageUnionReference.findAllIn(schema.id as SURefEnumSchemaName, () => true)
      const entries = items.filter(
        (item): item is typeof item & { id: string } => 'id' in item && !!item.id
      )

      for (const item of entries) {
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
    } catch {
      // Skip schemas that can't be loaded
    }
  }

  return paths
}
