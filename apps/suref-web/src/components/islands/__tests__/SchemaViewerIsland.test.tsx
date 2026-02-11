import { describe, it, expect } from 'bun:test'
import { render } from '@testing-library/react'
import { getEntitySchemas, getModel } from 'salvageunion-reference'
import { SchemaViewerIsland } from '../SchemaViewerIsland'

const entitySchemas = getEntitySchemas()

describe('SchemaViewerIsland', () => {
  for (const schema of entitySchemas) {
    const model = getModel(schema.id)
    if (!model) continue

    const entities = model.all()
    if (entities.length === 0) continue

    it(`renders all ${entities.length} entities for "${schema.displayName}" (${schema.id})`, () => {
      const { container } = render(
        <SchemaViewerIsland initialData={entities} schemaId={schema.id} />
      )

      const links = container.querySelectorAll('a')
      expect(links.length).toBe(entities.length)
    })
  }

  it('renders search input', () => {
    const firstSchema = entitySchemas[0]!
    const model = getModel(firstSchema.id)!
    const entities = model.all()

    const { container } = render(
      <SchemaViewerIsland initialData={entities} schemaId={firstSchema.id} />
    )

    const searchInput = container.querySelector('input[type="text"]')
    expect(searchInput).not.toBeNull()
  })
})
