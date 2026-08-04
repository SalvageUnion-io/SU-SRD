import { isSchemaName } from 'component-lib'
import type {
  EnhancedSchemaMetadata,
  SURefEntity,
  SURefObjectPattern,
} from 'salvageunion-reference'
import { nameToSlug, normalizePatternName, visiblePatterns } from 'salvageunion-reference'
import {
  getEntitySchemas,
  getModel,
  getReferenceEntityData,
  SalvageUnionReference,
} from './gameData'

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
      schema: EnhancedSchemaMetadata
      itemName: string
      itemDescription: string
    }
  }[] = []

  // Entity schemas only — meta schemas (actions, ability-tree-requirements,
  // catalog-categories) have no /schema/<id>/ listing page (see
  // getSchemaStaticPaths above), so item pages for them would be sitemap
  // orphans with 404 breadcrumbs. Their content renders inline on the pages
  // of the entities that own it. `getEntitySchemas()` IS that filter — going
  // through the helper keeps consumers that ask "does this schema have a
  // page?" (ITUN's hasSRDPage) agreeing with what actually gets generated.
  for (const schema of getEntitySchemas()) {
    // Runtime-validated narrowing (string catalog id → schema name) instead
    // of an assertion; a non-canonical id is skipped, same as a load failure.
    if (!isSchemaName(schema.id)) continue
    try {
      const items = SalvageUnionReference.findAllIn(schema.id, () => true)
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

/**
 * A page per chassis PATTERN, nested under its chassis:
 * `/schema/chassis/item/<chassis>/pattern/<pattern>/`.
 *
 * Patterns are nested objects on a chassis rather than a schema of their own,
 * so they are generated here instead of falling out of `getItemStaticPaths`.
 * `schemaId` is always `chassis` — it stays a param only so the route sits in
 * the existing `/schema/<schema>/item/<item>/` tree and its breadcrumbs
 * resolve like every other page's.
 */
export function getPatternStaticPaths() {
  const paths: {
    params: { schemaId: string; itemId: string; patternId: string }
    props: {
      chassis: SURefEntity
      pattern: SURefObjectPattern
      chassisName: string
      patternName: string
    }
  }[] = []

  for (const chassis of SalvageUnionReference.Chassis.all()) {
    const displayData = getReferenceEntityData(chassis)
    for (const pattern of visiblePatterns(chassis.patterns ?? [])) {
      paths.push({
        params: {
          schemaId: 'chassis',
          itemId: displayData.slug,
          patternId: nameToSlug(pattern.name),
        },
        props: {
          chassis,
          pattern,
          chassisName: displayData.name,
          patternName: normalizePatternName(pattern.name),
        },
      })
    }
  }

  return paths
}
