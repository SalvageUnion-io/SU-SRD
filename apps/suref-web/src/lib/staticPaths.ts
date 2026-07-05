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

/** A prev/next sibling reference within the same schema listing. */
type SiblingLink = { slug: string; name: string }

export function getItemStaticPaths() {
  const paths: {
    params: { schemaId: string; itemId: string }
    props: {
      item: SURefEntity
      schema: (typeof catalog.schemas)[number]
      itemName: string
      itemDescription: string
      /** Previous sibling in this schema's listing order, or null at the start. */
      prevItem: SiblingLink | null
      /** Next sibling in this schema's listing order, or null at the end. */
      nextItem: SiblingLink | null
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
      // Resolve display data once so prev/next can reference sibling slugs/names
      // from the same ordered list (no wrap-around: ends omit the missing side).
      const entries = items
        .filter((item): item is typeof item & { id: string } => 'id' in item && !!item.id)
        .map((item) => ({ item, displayData: getReferenceEntityData(item) }))

      entries.forEach(({ item, displayData }, index) => {
        const prev = index > 0 ? entries[index - 1] : undefined
        const next = index < entries.length - 1 ? entries[index + 1] : undefined

        paths.push({
          params: { schemaId: schema.id, itemId: displayData.slug },
          props: {
            item,
            schema,
            itemName: displayData.name,
            itemDescription: displayData.description ?? '',
            prevItem: prev ? { slug: prev.displayData.slug, name: prev.displayData.name } : null,
            nextItem: next ? { slug: next.displayData.slug, name: next.displayData.name } : null,
          },
        })
      })
    } catch {
      // Skip schemas that can't be loaded
    }
  }

  return paths
}
