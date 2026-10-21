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

describe('SchemaViewerIsland — the classes index (round 5)', () => {
  afterEach(() => {
    cleanup()
    window.location.href = 'http://localhost/'
  })

  it('opens a row for the Hybrid classes, apart from the Core classes', () => {
    const model = getModel('classes')
    if (!model) throw new Error('no classes model')
    const entities = model.all()
    const { container } = render(
      <SchemaViewerIsland
        schemaId="classes"
        techLevels={getUniqueTechLevels(entities)}
        sources={getUniqueSources(entities)}
      />
    )
    const breaks = container.querySelectorAll('li[data-row-break]')
    expect(breaks).toHaveLength(1)
    // The first Hybrid opens it, after the last Core class.
    const tiles = [...container.querySelectorAll('.su-listing__tiles > li')]
    const at = tiles.indexOf(breaks[0] as Element)
    expect(at).toBeGreaterThan(0)
    expect(tiles[at]?.querySelector('a')?.getAttribute('href')).not.toBe(
      tiles[0]?.querySelector('a')?.getAttribute('href')
    )
  })
})
