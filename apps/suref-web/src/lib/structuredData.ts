// Static date for SRD content — updated when the SRD is revised
const SRD_DATE = '2024-01-01'

type BreadcrumbItem = {
  name: string
  url: string
}

type DisplayDataPartial = {
  techLevel: number | 'B' | 'N' | null | undefined
  source: string | null | undefined
  assetUrl: string | null | undefined
} | null

type ItemPageArgs = {
  itemName: string
  metaDescription: string
  canonicalUrl: string
  schemaName: string
  schemaId: string
  displayData: DisplayDataPartial
}

type CollectionPageArgs = {
  schemaName: string
  canonicalUrl: string
  itemCount: number
}

export function buildBreadcrumbList(breadcrumbs: BreadcrumbItem[]): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: breadcrumbs.map((crumb, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: crumb.name,
      item: crumb.url,
    })),
  }
}

export function buildItemPageStructuredData({
  itemName,
  metaDescription,
  canonicalUrl,
  schemaName,
  schemaId,
  displayData,
}: ItemPageArgs): Record<string, unknown> {
  const result: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'TechArticle',
    name: itemName,
    description: metaDescription,
    url: canonicalUrl,
    datePublished: SRD_DATE,
    dateModified: SRD_DATE,
    keywords: ['Salvage Union', 'TTRPG', 'SRD', 'System Reference Document', schemaName, itemName],
    isPartOf: {
      '@type': 'CollectionPage',
      name: `${schemaName} - Salvage Union SRD`,
      url: `https://salvageunion.io/schema/${schemaId}/`,
    },
    mainEntity: {
      '@type': 'Thing',
      name: itemName,
      description: metaDescription,
      ...(displayData?.source
        ? {
            isPartOf: {
              '@type': 'Book',
              name: displayData.source,
              author: { '@type': 'Organization', name: 'Leyline Press' },
            },
          }
        : {}),
    },
  }

  if (displayData?.techLevel != null) {
    result.additionalProperty = {
      '@type': 'PropertyValue',
      name: 'Tech Level',
      value: displayData.techLevel,
    }
  }

  return result
}

export function buildCollectionPageStructuredData({
  schemaName,
  canonicalUrl,
  itemCount,
}: CollectionPageArgs): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: schemaName,
    description: `Browse all ${schemaName} in the Salvage Union SRD (System Reference Document). Complete reference with stats, abilities, and details.`,
    url: canonicalUrl,
    datePublished: SRD_DATE,
    dateModified: SRD_DATE,
    keywords: ['Salvage Union', 'TTRPG', 'SRD', 'System Reference Document', schemaName],
    isPartOf: {
      '@type': 'WebSite',
      name: 'Salvage Union System Reference Document',
      url: 'https://salvageunion.io/',
    },
    mainEntity: {
      '@type': 'ItemList',
      numberOfItems: itemCount,
    },
    creator: {
      '@type': 'Organization',
      name: 'Leyline Press',
    },
  }
}
