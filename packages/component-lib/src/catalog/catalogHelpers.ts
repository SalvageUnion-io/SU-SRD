import type {
  EnhancedSchemaMetadata,
  SURefEntity,
  SURefEnumSchemaName,
} from 'salvageunion-reference'
import { isSchemaName } from 'salvageunion-reference'

export type CatalogCategory = {
  id: string
  name: string
  schemas: string[]
  flat: boolean
}

export type CatalogCard = {
  id: string
  href: string
  /**
   * What the tile stands for. A `schema` tile opens a whole schema's listing;
   * an `entity` tile (the flat categories — guides) opens one entity outright.
   * srd encodes the same distinction in `href`; surfaces that drill in-place
   * rather than navigate (the Dashboard's SRD Explorer) need it as data.
   */
  kind: 'schema' | 'entity'
  /** The schema this tile belongs to — its own id for `schema`, the owning schema for `entity`. */
  schemaName: string
  /** Raw display name (no pluralization, no overrides) */
  displayName: string
  /** Rendered label (pluralized for schema entries, override-applied for flat items) */
  label: string
  catalogBg: string
  catalogLabel?: string
}

export type CatalogSection = {
  label: string
  schemas: CatalogCard[]
}

export const catalogNameOverrides: Record<string, string> = {
  'Activating and Shutting Down a Mech': 'Operating a Mech',
}

export const invariantNouns = new Set(['Chassis', 'Equipment', 'Meld'])

export function pluralizeWord(word: string): string {
  if (/[^aeiou]y$/i.test(word)) return `${word.slice(0, -1)}ies`
  if (/(?:s|sh|ch|x|z)$/i.test(word)) return `${word}es`
  return `${word}s`
}

export function pluralize(name: string, count: number): string {
  if (count <= 1 || invariantNouns.has(name)) return name
  const spaceIdx = name.lastIndexOf(' ')
  if (spaceIdx >= 0) {
    return name.slice(0, spaceIdx + 1) + pluralizeWord(name.slice(spaceIdx + 1))
  }
  return pluralizeWord(name)
}

type SchemaMapEntry = Pick<EnhancedSchemaMetadata, 'id' | 'displayName' | 'itemCount'>

type BuildCatalogCategoriesOptions = {
  catalogCategories: CatalogCategory[]
  schemaMap: Map<string, SchemaMapEntry>
  findAllIn: (
    schemaName: SURefEnumSchemaName,
    predicate: (entity: SURefEntity) => boolean
  ) => Array<{ id: string; name: string; [key: string]: unknown }>
  getReferenceEntityData: (item: SURefEntity) => {
    slug: string
    [key: string]: unknown
  }
  getCatalogBg: (schemaId: string) => string
  getCatalogLabel: (schemaId: string) => string | undefined
}

export function buildCatalogCategories({
  catalogCategories,
  schemaMap,
  findAllIn,
  getReferenceEntityData,
  getCatalogBg,
  getCatalogLabel,
}: BuildCatalogCategoriesOptions): CatalogSection[] {
  return catalogCategories.map((cat) => {
    if (cat.flat) {
      // Flat catalog categories are static config that always lists exactly
      // one schema; guard (runtime schema-name validation, not an assertion)
      // so malformed config renders an empty section rather than crashing
      // the build.
      const schemaName = cat.schemas[0]
      if (!schemaName || !isSchemaName(schemaName)) {
        return { label: cat.name.toUpperCase(), schemas: [] }
      }
      const items = findAllIn(schemaName, () => true)
      return {
        label: cat.name.toUpperCase(),
        schemas: items.map((item) => {
          const display = getReferenceEntityData(item as SURefEntity)
          const rawName = item.name
          const labelText = catalogNameOverrides[rawName] ?? rawName
          const guideColor = typeof item.guideColor === 'string' ? item.guideColor : undefined
          return {
            id: item.id,
            href: `/schema/${schemaName}/item/${display.slug}/`,
            kind: 'entity' as const,
            schemaName,
            displayName: rawName,
            label: labelText,
            catalogBg: guideColor || getCatalogBg(schemaName),
          }
        }),
      }
    }

    return {
      label: cat.name.toUpperCase(),
      schemas: cat.schemas.flatMap((id) => {
        const s = schemaMap.get(id)
        if (!s) return []
        // `displayName` is always populated — getSchemaCatalog() falls back to
        // the raw title itself — so there is nothing left to strip here. (The
        // old `title.replace('Salvage Union ', '')` fallback matched no title
        // in the catalog; every one of them is the kebab-case schema id.)
        const rawDisplayName = s.displayName
        return [
          {
            id: s.id,
            href: `/schema/${s.id}/`,
            kind: 'schema' as const,
            schemaName: s.id,
            displayName: rawDisplayName,
            label: pluralize(rawDisplayName, s.itemCount),
            catalogBg: getCatalogBg(s.id),
            catalogLabel: getCatalogLabel(s.id),
          },
        ]
      }),
    }
  })
}
