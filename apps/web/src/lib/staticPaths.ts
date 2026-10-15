import type { EnhancedSchemaMetadata, RefEntity, RefObjectAnyPattern } from 'salvageunion-reference'
import {
  displayTitle,
  getPatterns,
  isSchemaName,
  nameToSlug,
  normalizePatternName,
} from 'salvageunion-reference'
import {
  getEntitySchemas,
  getModel,
  getReferenceEntityData,
  SalvageUnionReference,
} from './gameData'

export function getSchemaStaticPaths() {
  return getEntitySchemas().map((schema) => {
    const model = getModel(schema.id)
    const data: RefEntity[] = model ? model.all() : []
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
      item: RefEntity
      schema: EnhancedSchemaMetadata
      itemName: string
      itemDescription: string
    }
  }[] = []

  // Entity schemas only — meta schemas (actions, ability-tree-requirements,
  // catalog-categories) have no /<id>/ listing page (see
  // getSchemaStaticPaths above), so item pages for them would be sitemap
  // orphans with 404 breadcrumbs. Their content renders inline on the pages
  // of the entities that own it. `getEntitySchemas()` IS that filter — going
  // through the helper keeps consumers that ask "does this schema have a
  // page?" (The Cantina's hasSRDPage) agreeing with what actually gets generated.
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
            // The page's words outside CSS (<title>, meta, JSON-LD,
            // breadcrumbs) print a glossary name as the book does.
            itemName: displayTitle(displayData.name),
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
 * A page per PATTERN, nested under its host:
 * `/<schema>/<host>/pattern/<pattern>/` — a chassis's mech
 * patterns and a Bio-Titan's variants alike.
 *
 * Patterns are nested objects on their host rather than a schema of their own,
 * so they are generated here instead of falling out of `getItemStaticPaths`.
 * Any entity schema whose rows carry visible `patterns` gets them; `schemaId`
 * is the host's, so the route sits in the existing `/<schema>/<item>/`
 * tree and its breadcrumbs resolve like every other page's.
 */
export function getPatternStaticPaths() {
  const paths: {
    params: { schemaId: string; itemId: string; patternId: string }
    props: {
      host: RefEntity
      schema: EnhancedSchemaMetadata
      pattern: RefObjectAnyPattern
      hostName: string
      patternName: string
    }
  }[] = []

  for (const schema of getEntitySchemas()) {
    if (!isSchemaName(schema.id)) continue
    const model = getModel(schema.id)
    if (!model) continue
    for (const host of model.all()) {
      const patterns = getPatterns(host) ?? []
      if (patterns.length === 0) continue
      const displayData = getReferenceEntityData(host)
      for (const pattern of patterns) {
        paths.push({
          params: {
            schemaId: schema.id,
            itemId: displayData.slug,
            patternId: nameToSlug(pattern.name),
          },
          props: {
            host,
            schema,
            pattern,
            hostName: displayData.name,
            patternName: normalizePatternName(pattern.name),
          },
        })
      }
    }
  }

  return paths
}
