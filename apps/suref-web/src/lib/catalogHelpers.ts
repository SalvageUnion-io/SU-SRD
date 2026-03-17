import type { EnhancedSchemaMetadata } from 'salvageunion-reference'

export type CatalogCategory = {
  id: string
  name: string
  schemas: string[]
  flat: boolean
}

export type CatalogCard = {
  id: string
  href: string
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
  if (/[^aeiou]y$/i.test(word)) return word.slice(0, -1) + 'ies'
  if (/(?:s|sh|ch|x|z)$/i.test(word)) return word + 'es'
  return word + 's'
}

export function pluralize(name: string, count: number): string {
  if (count <= 1 || invariantNouns.has(name)) return name
  const spaceIdx = name.lastIndexOf(' ')
  if (spaceIdx >= 0) {
    return name.slice(0, spaceIdx + 1) + pluralizeWord(name.slice(spaceIdx + 1))
  }
  return pluralizeWord(name)
}

type SchemaMapEntry = Pick<EnhancedSchemaMetadata, 'id' | 'title' | 'displayName' | 'itemCount'>

type BuildCatalogCategoriesOptions = {
  catalogCategories: CatalogCategory[]
  schemaMap: Map<string, SchemaMapEntry>
  findAllIn: (
    schemaName: string,
    predicate: () => boolean
  ) => Array<{ id: string; name: string; [key: string]: unknown }>
  getReferenceEntityData: (item: { id: string; name: string; [key: string]: unknown }) => {
    slug: string
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
      const schemaName = cat.schemas[0]!
      const items = findAllIn(schemaName, () => true)
      return {
        label: cat.name.toUpperCase(),
        schemas: items.map((item) => {
          const display = getReferenceEntityData(item)
          const rawName = item.name
          const labelText = catalogNameOverrides[rawName] ?? rawName
          return {
            id: item.id,
            href: `/schema/${schemaName}/item/${display.slug}/`,
            displayName: rawName,
            label: labelText,
            catalogBg: (item as { guideColor?: string }).guideColor || getCatalogBg(schemaName),
          }
        }),
      }
    }

    return {
      label: cat.name.toUpperCase(),
      schemas: cat.schemas.flatMap((id) => {
        const s = schemaMap.get(id)
        if (!s) return []
        const rawDisplayName = s.displayName || s.title.replace('Salvage Union ', '')
        return [
          {
            id: s.id,
            href: `/schema/${s.id}/`,
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
