import { describe, it, expect } from 'bun:test'
import {
  pluralizeWord,
  pluralize,
  buildCatalogCategories,
  invariantNouns,
  catalogNameOverrides,
} from '../catalogHelpers'
import type { CatalogCategory } from '../catalogHelpers'

/** Narrowing guard for fixture lookups — fails the test loudly instead of `!`. */
function required<T>(value: T | null | undefined, label: string): T {
  if (value == null) throw new Error(`Expected ${label} to exist`)
  return value
}

describe('pluralizeWord', () => {
  it('adds s to regular words', () => {
    expect(pluralizeWord('Drone')).toBe('Drones')
    expect(pluralizeWord('Creature')).toBe('Creatures')
    expect(pluralizeWord('System')).toBe('Systems')
  })

  it('adds es to words ending in s, sh, ch, x, z', () => {
    expect(pluralizeWord('Class')).toBe('Classes')
    expect(pluralizeWord('Bench')).toBe('Benches')
    expect(pluralizeWord('Box')).toBe('Boxes')
  })

  it('converts words ending in consonant+y to ies', () => {
    expect(pluralizeWord('Category')).toBe('Categories')
    expect(pluralizeWord('Ability')).toBe('Abilities')
  })

  it('does not convert words ending in vowel+y', () => {
    expect(pluralizeWord('Bay')).toBe('Bays')
  })
})

describe('pluralize', () => {
  it('returns name unchanged when count is 1', () => {
    expect(pluralize('Drone', 1)).toBe('Drone')
  })

  it('returns name unchanged when count is 0', () => {
    expect(pluralize('Drone', 0)).toBe('Drone')
  })

  it('pluralizes single word when count > 1', () => {
    expect(pluralize('Drone', 5)).toBe('Drones')
  })

  it('pluralizes last word of a multi-word name', () => {
    expect(pluralize('Crawler Bay', 3)).toBe('Crawler Bays')
  })

  it('leaves invariant nouns unchanged regardless of count', () => {
    for (const noun of invariantNouns) {
      expect(pluralize(noun, 10)).toBe(noun)
    }
  })
})

describe('catalogNameOverrides', () => {
  it('contains the Activating and Shutting Down a Mech override', () => {
    expect(catalogNameOverrides['Activating and Shutting Down a Mech']).toBe('Operating a Mech')
  })
})

describe('buildCatalogCategories', () => {
  it('returns an array of sections with label and schemas', () => {
    const fakeCatalogCategories: CatalogCategory[] = [
      {
        id: 'cat-1',
        name: 'Combat',
        schemas: ['chassis'],
        flat: false,
      },
    ]

    const fakeSchemaMap = new Map([
      [
        'chassis',
        {
          id: 'chassis',
          displayName: 'Chassis',
          title: 'Salvage Union Chassis',
          itemCount: 10,
          meta: false,
        },
      ],
    ])

    const result = buildCatalogCategories({
      catalogCategories: fakeCatalogCategories,
      schemaMap: fakeSchemaMap,
      findAllIn: () => [],
      getReferenceEntityData: () => ({ slug: 'test-slug' }),
      getCatalogBg: (id) => `bg-${id}`,
      getCatalogLabel: () => undefined,
    })

    expect(result).toHaveLength(1)
    expect(result[0]?.label).toBe('COMBAT')
    expect(result[0]?.schemas).toHaveLength(1)
  })

  it('builds correct schema entry for non-flat category', () => {
    const fakeCatalogCategories: CatalogCategory[] = [
      {
        id: 'cat-1',
        name: 'Mechs',
        schemas: ['chassis'],
        flat: false,
      },
    ]

    const fakeSchemaMap = new Map([
      [
        'chassis',
        {
          id: 'chassis',
          displayName: 'Chassis',
          title: 'Salvage Union Chassis',
          itemCount: 10,
          meta: false,
        },
      ],
    ])

    const result = buildCatalogCategories({
      catalogCategories: fakeCatalogCategories,
      schemaMap: fakeSchemaMap,
      findAllIn: () => [],
      getReferenceEntityData: () => ({ slug: 'test-slug' }),
      getCatalogBg: (id) => `bg-${id}`,
      getCatalogLabel: () => undefined,
    })

    const schema = required(result[0], 'first catalog section').schemas[0]
    if (!schema) throw new Error('Expected a first schema entry')
    expect(schema.id).toBe('chassis')
    expect(schema.href).toBe('/schema/chassis/')
    expect(schema.catalogBg).toBe('bg-chassis')
    // 'Chassis' is an invariant noun — should not be pluralized
    expect(schema.displayName).toBe('Chassis')
    expect(schema.label).toBe('Chassis')
  })

  it('pluralizes displayName when count > 1 for non-invariant nouns', () => {
    const fakeCatalogCategories: CatalogCategory[] = [
      {
        id: 'cat-1',
        name: 'Items',
        schemas: ['drones'],
        flat: false,
      },
    ]

    const fakeSchemaMap = new Map([
      [
        'drones',
        {
          id: 'drones',
          displayName: 'Drone',
          title: 'Salvage Union Drones',
          itemCount: 5,
          meta: false,
        },
      ],
    ])

    const result = buildCatalogCategories({
      catalogCategories: fakeCatalogCategories,
      schemaMap: fakeSchemaMap,
      findAllIn: () => [],
      getReferenceEntityData: () => ({ slug: 'test-slug' }),
      getCatalogBg: (id) => `bg-${id}`,
      getCatalogLabel: () => undefined,
    })

    const schema = required(result[0], 'first catalog section').schemas[0]
    if (!schema) throw new Error('Expected a first schema entry')
    expect(schema.label).toBe('Drones')
    expect(schema.displayName).toBe('Drone')
  })

  it('skips schemas not in schemaMap for non-flat categories', () => {
    const fakeCatalogCategories: CatalogCategory[] = [
      {
        id: 'cat-1',
        name: 'Mechs',
        schemas: ['chassis', 'unknown-schema'],
        flat: false,
      },
    ]

    const fakeSchemaMap = new Map([
      [
        'chassis',
        {
          id: 'chassis',
          displayName: 'Chassis',
          title: 'Salvage Union Chassis',
          itemCount: 3,
          meta: false,
        },
      ],
    ])

    const result = buildCatalogCategories({
      catalogCategories: fakeCatalogCategories,
      schemaMap: fakeSchemaMap,
      findAllIn: () => [],
      getReferenceEntityData: () => ({ slug: 'test-slug' }),
      getCatalogBg: () => 'bg-default',
      getCatalogLabel: () => undefined,
    })

    expect(result[0]?.schemas).toHaveLength(1)
  })

  it('handles flat categories by listing individual items', () => {
    const fakeCatalogCategories: CatalogCategory[] = [
      {
        id: 'cat-guides',
        name: 'Guides',
        schemas: ['guides'],
        flat: true,
      },
    ]

    const fakeItems = [
      { id: 'guide-1', name: 'Combat Guide' },
      { id: 'guide-2', name: 'Activating and Shutting Down a Mech' },
    ]

    const result = buildCatalogCategories({
      catalogCategories: fakeCatalogCategories,
      schemaMap: new Map(),
      findAllIn: () => fakeItems,
      getReferenceEntityData: (item) => ({ slug: `slug-${item.id}` }),
      getCatalogBg: (id) => `bg-${id}`,
      getCatalogLabel: () => undefined,
    })

    const section = required(result[0], 'first catalog section')
    expect(section.label).toBe('GUIDES')
    expect(section.schemas).toHaveLength(2)

    const first = required(section.schemas[0], 'first schema entry')
    expect(first.id).toBe('guide-1')
    expect(first.href).toBe('/schema/guides/item/slug-guide-1/')
    expect(first.displayName).toBe('Combat Guide')
    expect(first.label).toBe('Combat Guide')

    // catalogNameOverrides should apply
    const second = required(section.schemas[1], 'second schema entry')
    expect(second.label).toBe('Operating a Mech')
  })

  it('includes catalogLabel when getCatalogLabel returns a value', () => {
    const fakeCatalogCategories: CatalogCategory[] = [
      {
        id: 'cat-1',
        name: 'Items',
        schemas: ['equipment'],
        flat: false,
      },
    ]

    const fakeSchemaMap = new Map([
      [
        'equipment',
        {
          id: 'equipment',
          displayName: 'Equipment',
          title: 'Salvage Union Equipment',
          itemCount: 20,
          meta: false,
        },
      ],
    ])

    const result = buildCatalogCategories({
      catalogCategories: fakeCatalogCategories,
      schemaMap: fakeSchemaMap,
      findAllIn: () => [],
      getReferenceEntityData: () => ({ slug: 'test-slug' }),
      getCatalogBg: () => 'bg-equipment',
      getCatalogLabel: () => 'label-color',
    })

    expect(result[0]?.schemas[0]?.catalogLabel).toBe('label-color')
  })
})
