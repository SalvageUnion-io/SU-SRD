import { describe, it, expect } from 'bun:test'
import {
  buildItemPageStructuredData,
  buildCollectionPageStructuredData,
  buildBreadcrumbList,
} from '../structuredData'

type BreadcrumbItem = { name: string; url: string }

const sampleBreadcrumbs: BreadcrumbItem[] = [
  { name: 'SRD', url: 'https://salvageunion.io/' },
  { name: 'Chassis', url: 'https://salvageunion.io/schema/chassis/' },
  { name: 'Iron Mongrel', url: 'https://salvageunion.io/schema/chassis/item/iron-mongrel/' },
]

describe('buildBreadcrumbList', () => {
  it('returns a BreadcrumbList object with @context and @type', () => {
    const result = buildBreadcrumbList(sampleBreadcrumbs)
    expect(result['@context']).toBe('https://schema.org')
    expect(result['@type']).toBe('BreadcrumbList')
  })

  it('maps breadcrumb items to ListItem elements with correct position', () => {
    const result = buildBreadcrumbList(sampleBreadcrumbs)
    const items = result.itemListElement as Array<Record<string, unknown>>
    expect(items).toHaveLength(3)
    expect(items[0]).toEqual({
      '@type': 'ListItem',
      position: 1,
      name: 'SRD',
      item: 'https://salvageunion.io/',
    })
    expect(items[1]).toEqual({
      '@type': 'ListItem',
      position: 2,
      name: 'Chassis',
      item: 'https://salvageunion.io/schema/chassis/',
    })
    expect(items[2]).toEqual({
      '@type': 'ListItem',
      position: 3,
      name: 'Iron Mongrel',
      item: 'https://salvageunion.io/schema/chassis/item/iron-mongrel/',
    })
  })

  it('handles an empty breadcrumb array', () => {
    const result = buildBreadcrumbList([])
    const items = result.itemListElement as Array<unknown>
    expect(items).toHaveLength(0)
  })
})

describe('buildItemPageStructuredData', () => {
  const baseArgs = {
    itemName: 'Iron Mongrel',
    metaDescription: 'A powerful mech chassis.',
    canonicalUrl: 'https://salvageunion.io/schema/chassis/item/iron-mongrel/',
    schemaName: 'Chassis',
    schemaId: 'chassis',
    displayData: null,
  }

  it('returns an object with @context set to https://schema.org', () => {
    const result = buildItemPageStructuredData(baseArgs)
    expect(result['@context']).toBe('https://schema.org')
  })

  it('uses TechArticle as the @type', () => {
    const result = buildItemPageStructuredData(baseArgs)
    expect(result['@type']).toBe('TechArticle')
  })

  it('includes name, description, and url', () => {
    const result = buildItemPageStructuredData(baseArgs)
    expect(result.name).toBe('Iron Mongrel')
    expect(result.description).toBe('A powerful mech chassis.')
    expect(result.url).toBe('https://salvageunion.io/schema/chassis/item/iron-mongrel/')
  })

  it('includes keywords array with standard SRD terms', () => {
    const result = buildItemPageStructuredData(baseArgs)
    const keywords = result.keywords as string[]
    expect(keywords).toContain('Salvage Union')
    expect(keywords).toContain('TTRPG')
    expect(keywords).toContain('SRD')
    expect(keywords).toContain('Chassis')
    expect(keywords).toContain('Iron Mongrel')
  })

  it('includes isPartOf referencing the schema collection page', () => {
    const result = buildItemPageStructuredData(baseArgs)
    const isPartOf = result.isPartOf as Record<string, unknown>
    expect(isPartOf['@type']).toBe('CollectionPage')
    expect(isPartOf.url).toBe('https://salvageunion.io/schema/chassis/')
  })

  it('includes datePublished and dateModified', () => {
    const result = buildItemPageStructuredData(baseArgs)
    expect(result.datePublished).toBeDefined()
    expect(result.dateModified).toBeDefined()
  })

  it('includes techLevel in additionalProperty when displayData has techLevel', () => {
    const result = buildItemPageStructuredData({
      ...baseArgs,
      displayData: { techLevel: 2, source: null, assetUrl: null },
    })
    const prop = result.additionalProperty as Record<string, unknown>
    expect(prop['@type']).toBe('PropertyValue')
    expect(prop.name).toBe('Tech Level')
    expect(prop.value).toBe(2)
  })

  it('omits additionalProperty when displayData has no techLevel', () => {
    const result = buildItemPageStructuredData({
      ...baseArgs,
      displayData: { techLevel: null, source: null, assetUrl: null },
    })
    expect(result.additionalProperty).toBeUndefined()
  })

  it('includes source in mainEntity when displayData has source', () => {
    const result = buildItemPageStructuredData({
      ...baseArgs,
      displayData: { techLevel: null, source: 'Core Rulebook', assetUrl: null },
    })
    const mainEntity = result.mainEntity as Record<string, unknown>
    const isPartOf = mainEntity.isPartOf as Record<string, unknown>
    expect(isPartOf['@type']).toBe('Book')
    expect(isPartOf.name).toBe('Core Rulebook')
  })

  it('omits source in mainEntity when displayData has no source', () => {
    const result = buildItemPageStructuredData({
      ...baseArgs,
      displayData: { techLevel: null, source: null, assetUrl: null },
    })
    const mainEntity = result.mainEntity as Record<string, unknown>
    expect(mainEntity.isPartOf).toBeUndefined()
  })
})

describe('buildCollectionPageStructuredData', () => {
  const baseArgs = {
    schemaName: 'Chassis',
    canonicalUrl: 'https://salvageunion.io/schema/chassis/',
    itemCount: 42,
  }

  it('returns an object with @context set to https://schema.org', () => {
    const result = buildCollectionPageStructuredData(baseArgs)
    expect(result['@context']).toBe('https://schema.org')
  })

  it('uses CollectionPage as the @type', () => {
    const result = buildCollectionPageStructuredData(baseArgs)
    expect(result['@type']).toBe('CollectionPage')
  })

  it('includes name, description, and url', () => {
    const result = buildCollectionPageStructuredData(baseArgs)
    expect(result.name).toBe('Chassis')
    expect(result.url).toBe('https://salvageunion.io/schema/chassis/')
    expect(typeof result.description).toBe('string')
  })

  it('includes the item count in mainEntity', () => {
    const result = buildCollectionPageStructuredData(baseArgs)
    const mainEntity = result.mainEntity as Record<string, unknown>
    expect(mainEntity.numberOfItems).toBe(42)
  })

  it('includes datePublished and dateModified', () => {
    const result = buildCollectionPageStructuredData(baseArgs)
    expect(result.datePublished).toBeDefined()
    expect(result.dateModified).toBeDefined()
  })

  it('includes creator with Leyline Press', () => {
    const result = buildCollectionPageStructuredData(baseArgs)
    const creator = result.creator as Record<string, unknown>
    expect(creator['@type']).toBe('Organization')
    expect(creator.name).toBe('Leyline Press')
  })
})
