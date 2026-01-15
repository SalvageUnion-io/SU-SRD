import { createFileRoute } from '@tanstack/react-router'
import { getSchemaCatalog } from 'salvageunion-reference'
import { RulesReferenceLanding } from '../components/Reference/RulesReferenceLanding'
import { ReferenceError } from '../components/errors/ReferenceError'

const schemaIndexData = getSchemaCatalog()

function IndexPage() {
  return <RulesReferenceLanding />
}

export const Route = createFileRoute('/')({
  component: IndexPage,
  errorComponent: ReferenceError,
  loader: () => {
    return { schemas: schemaIndexData.schemas.filter((s) => !s.meta) }
  },
  head: () => ({
    meta: [
      {
        title: 'Salvage Union System Reference Document',
      },
      {
        name: 'description',
        content:
          'System Reference Document (SRD) for the Salvage Union TTRPG. Complete reference guide with chassis, systems, modules, abilities, and more.',
      },
      {
        property: 'og:title',
        content: 'Salvage Union System Reference Document',
      },
      {
        property: 'og:description',
        content:
          'System Reference Document (SRD) for the Salvage Union TTRPG. Complete reference guide with chassis, systems, modules, abilities, and more.',
      },
      {
        property: 'og:type',
        content: 'website',
      },
    ],
  }),
  staticData: {
    ssr: true,
    prerender: true,
  },
})
