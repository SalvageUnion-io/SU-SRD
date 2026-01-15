import { createFileRoute } from '@tanstack/react-router'
import { getSchemaCatalog, SalvageUnionReference } from 'salvageunion-reference'
import type { SURefEnumSchemaName } from 'salvageunion-reference'
import ItemShowPage from '../../../../components/ItemShowPage'
import { ReferenceError } from '../../../../components/errors/ReferenceError'
import { findEntityBySlug, getEntitySlug } from '../../../../utils/slug'

const schemaIndexData = getSchemaCatalog()

export const Route = createFileRoute('/schema/$schemaId/item/$itemId')({
  component: ItemShowPageComponent,
  errorComponent: ReferenceError,
  loader: ({ params }) => {
    const schema = schemaIndexData.schemas.find((s) => s.id === params.schemaId)

    let item = null
    let itemName = params.itemId
    let itemDescription = ''
    if (schema) {
      // Try to find by slug first (URL-safe name)
      item = findEntityBySlug(params.schemaId as SURefEnumSchemaName, params.itemId)

      // Fallback to ID lookup for backward compatibility
      if (!item) {
        try {
          item = SalvageUnionReference.findIn(
            params.schemaId as SURefEnumSchemaName,
            (i) => i.id === params.itemId
          )
        } catch {
          // Ignore errors when item not found
        }
      }

      if (item) {
        if ('name' in item && item.name) {
          itemName = item.name as string
        }
        if ('description' in item && typeof item.description === 'string') {
          itemDescription = item.description
        }
      }
    }
    return { schemas: schemaIndexData.schemas, schema, itemName, itemDescription, item }
  },
  validateSearch: (search: Record<string, unknown>): { pattern?: string; compact?: string } => {
    return {
      pattern: search.pattern ? String(search.pattern) : undefined,
      compact: search.compact ? String(search.compact) : undefined,
    }
  },
  head: ({ loaderData, params }) => {
    const schemaName = loaderData?.schema?.displayName || 'Item'
    const itemName = loaderData?.itemName || 'Unknown'
    const itemDescription = loaderData?.itemDescription || ''
    const item = loaderData?.item
    const schemaId = params.schemaId

    // Always use slug for SEO URLs, even if item was found by ID (backward compatibility)
    const itemSlug = item ? getEntitySlug(item) : params.itemId
    const canonicalUrl = `https://su-srd.pages.dev/schema/${schemaId}/item/${itemSlug}`

    const metaDescription =
      itemDescription ||
      `Detailed information about ${itemName} from ${schemaName} in Salvage Union TTRPG.`

    const structuredData: Record<string, unknown> = {
      '@context': 'https://schema.org',
      '@type': 'Article',
      headline: itemName,
      description: metaDescription,
      url: canonicalUrl,
      keywords: [
        'Salvage Union',
        'TTRPG',
        'SRD',
        'System Reference Document',
        schemaName,
        itemName,
      ],
      author: {
        '@type': 'Organization',
        name: 'Salvage Union SRD',
      },
    }

    if (item) {
      if ('source' in item && item.source) {
        structuredData.isPartOf = {
          '@type': 'Book',
          name: item.source as string,
        }
      }
      if ('page' in item && item.page) {
        structuredData.pagination = `Page ${item.page}`
      }

      if ('stats' in item && item.stats && typeof item.stats === 'object') {
        const stats = item.stats as Record<string, unknown>
        if ('techLevel' in stats && stats.techLevel) {
          structuredData.additionalProperty = {
            '@type': 'PropertyValue',
            name: 'Tech Level',
            value: stats.techLevel,
          }
        }
      }
    }

    return {
      meta: [
        {
          title: `${itemName} - ${schemaName} - Salvage Union System Reference Document`,
        },
        {
          name: 'description',
          content: metaDescription,
        },
        {
          name: 'canonical',
          content: canonicalUrl,
        },
        {
          property: 'og:title',
          content: `${itemName} - ${schemaName} - Salvage Union System Reference Document`,
        },
        {
          property: 'og:description',
          content: metaDescription,
        },
        {
          property: 'og:url',
          content: canonicalUrl,
        },
        {
          property: 'og:type',
          content: 'article',
        },
        {
          name: 'twitter:card',
          content: 'summary',
        },
        {
          name: 'twitter:title',
          content: `${itemName} - ${schemaName} - Salvage Union System Reference Document`,
        },
        {
          name: 'twitter:description',
          content: metaDescription,
        },
        {
          name: 'twitter:url',
          content: canonicalUrl,
        },
      ],
      scripts: [
        {
          type: 'application/ld+json',
          children: JSON.stringify(structuredData),
        },
      ],
    }
  },
  staticData: {
    ssr: true,
    prerender: true,
  },
})

function ItemShowPageComponent() {
  const { item } = Route.useLoaderData()
  return <ItemShowPage prefetchedItem={item} />
}
