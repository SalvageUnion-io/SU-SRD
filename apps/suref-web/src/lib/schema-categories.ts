type SchemaCategory = { label: string; schemaIds: string[] }
type ItemsFromCategory = { label: string; itemsFrom: string }

export type CategoryEntry = SchemaCategory | ItemsFromCategory

export function isItemsFromCategory(entry: CategoryEntry): entry is ItemsFromCategory {
  return 'itemsFrom' in entry
}

export const schemaCategories: CategoryEntry[] = [
  { label: 'PILOT', schemaIds: ['classes', 'abilities', 'equipment'] },
  { label: 'MECH', schemaIds: ['chassis', 'systems', 'modules'] },
  { label: 'CRAWLER', schemaIds: ['crawlers', 'crawler-bays', 'crawler-tech-levels'] },
  {
    label: 'DENIZENS',
    schemaIds: [
      'bio-titans',
      'creatures',
      'drones',
      'factions',
      'meld',
      'npcs',
      'squads',
      'vehicles',
    ],
  },
  {
    label: 'REFERENCE',
    schemaIds: ['distances', 'keywords', 'roll-tables', 'traits'],
  },
  { label: 'GUIDES', itemsFrom: 'guides' },
]
