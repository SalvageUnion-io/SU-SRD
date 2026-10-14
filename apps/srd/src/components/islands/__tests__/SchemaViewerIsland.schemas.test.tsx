import { afterEach, describe, expect, it } from 'bun:test'
import { cleanup, render } from '@testing-library/react'
import {
  getEntitySchemas,
  getModel,
  getUniqueSources,
  getUniqueTechLevels,
} from 'salvageunion-reference'
import { SchemaViewerIsland } from '../SchemaViewerIsland'

/**
 * Every schema's listing renders every entity — split out of
 * SchemaViewerIsland.test.tsx so the parallel runner can run the whole-catalog
 * renders beside the interaction tests.
 */

const entitySchemas = getEntitySchemas()

describe('SchemaViewerIsland', () => {
  // As in SchemaViewerIsland.test.tsx: a leaked ?q=/?tl= would filter later renders.
  afterEach(() => {
    cleanup()
    window.location.href = 'http://localhost/'
  })

  for (const schema of entitySchemas) {
    const model = getModel(schema.id)
    if (!model) continue

    const entities = model.all()
    if (entities.length === 0) continue

    it(`renders all ${entities.length} entities for "${schema.displayName}" (${schema.id})`, () => {
      const { container } = render(
        <SchemaViewerIsland
          schemaId={schema.id}
          techLevels={getUniqueTechLevels(entities)}
          sources={getUniqueSources(entities)}
        />
      )

      const links = container.querySelectorAll('a')
      expect(links.length).toBe(entities.length)
    })
  }
})
