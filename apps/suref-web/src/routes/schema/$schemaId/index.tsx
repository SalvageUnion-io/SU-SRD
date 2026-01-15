import { createFileRoute } from '@tanstack/react-router'
import { getSchemaCatalog } from 'salvageunion-reference'
import { z } from 'zod'
import SchemaViewer from '../../../components/schema/SchemaViewer'
import { ReferenceError } from '../../../components/errors/ReferenceError'
import { getModel } from 'salvageunion-reference'
import type { SURefEntity } from 'salvageunion-reference'

const schemaIndexData = getSchemaCatalog()

const schemaViewerSearchSchema = z.object({
  search: z.string().optional(),
  tl: z.array(z.union([z.number(), z.literal('B'), z.literal('N')])).optional(),
  source: z.array(z.string()).optional(),
})

export const Route = createFileRoute('/schema/$schemaId/')({
  component: SchemaViewerPage,
  errorComponent: ReferenceError,
  validateSearch: schemaViewerSearchSchema,
  loader: ({ params }) => {
    const schema = schemaIndexData.schemas.find((s) => s.id === params.schemaId)

    let data: SURefEntity[] = []
    if (schema) {
      const model = getModel(params.schemaId)
      if (model) {
        data = model.all() as SURefEntity[]
      }
    }

    return { schemas: schemaIndexData.schemas, schema, data }
  },
  head: ({ loaderData }) => {
    const schemaName = loaderData?.schema?.displayName || 'Schema'
    const schemaId = loaderData?.schema?.id || ''
    const canonicalUrl = `https://su-srd.pages.dev/schema/${schemaId}`
    return {
      meta: [
        {
          title: `${schemaName} - Salvage Union System Reference Document`,
        },
        {
          name: 'description',
          content: `Browse all ${schemaName} in the Salvage Union SRD (System Reference Document). Complete reference with stats, abilities, and details.`,
        },
        {
          name: 'canonical',
          content: canonicalUrl,
        },
        {
          property: 'og:title',
          content: `${schemaName} - Salvage Union System Reference Document`,
        },
        {
          property: 'og:description',
          content: `Browse all ${schemaName} in the Salvage Union SRD (System Reference Document). Complete reference with stats, abilities, and details.`,
        },
        {
          property: 'og:url',
          content: canonicalUrl,
        },
        {
          property: 'og:type',
          content: 'website',
        },
      ],
      scripts: [
        {
          type: 'application/ld+json',
          children: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'Dataset',
            name: schemaName,
            description: `Salvage Union ${schemaName} System Reference Document (SRD) data`,
            url: canonicalUrl,
            keywords: ['Salvage Union', 'TTRPG', 'SRD', 'System Reference Document', schemaName],
            creator: {
              '@type': 'Organization',
              name: 'Salvage Union SRD',
            },
          }),
        },
      ],
    }
  },
  staticData: {
    ssr: true,
    prerender: true,
  },
})

function SchemaViewerPage() {
  const { schemas, data } = Route.useLoaderData()
  return <SchemaViewer schemas={schemas} data={data} />
}
