import { describe, it, expect } from 'bun:test'
import { render, within, fireEvent, screen } from '@testing-library/react'
import {
  getEntitySchemas,
  getModel,
  getUniqueTechLevels,
  getUniqueSources,
} from 'salvageunion-reference'
import { SchemaViewerIsland } from '../SchemaViewerIsland'

const entitySchemas = getEntitySchemas()

describe('SchemaViewerIsland', () => {
  it('renders FilterRow labels as visible text for filter sections', () => {
    // FilterRow renders a visible <span> label — old code used aria-label (not visible text)
    // Verifies FilterRow is used rather than the old manual div+role="group" pattern
    const firstSchema = entitySchemas[0]!
    const model = getModel(firstSchema.id)!
    const entities = model.all()

    const { container } = render(
      <SchemaViewerIsland
        initialData={entities}
        schemaId={firstSchema.id}
        techLevels={[1, 2, 3]}
        sources={['Core', 'Rig']}
      />
    )

    // FilterRow renders the label as visible text in a <span>. Scope to the
    // filter rail — entity cards (e.g. granted equipment) also surface a
    // "Tech Level" badge in the grid.
    const filterRail = container.querySelector('aside')!
    expect(within(filterRail).getByText('Tech Level')).toBeTruthy()
    expect(within(filterRail).getByText('Source')).toBeTruthy()
  })

  for (const schema of entitySchemas) {
    const model = getModel(schema.id)
    if (!model) continue

    const entities = model.all()
    if (entities.length === 0) continue

    it(`renders all ${entities.length} entities for "${schema.displayName}" (${schema.id})`, () => {
      const { container } = render(
        <SchemaViewerIsland
          initialData={entities}
          schemaId={schema.id}
          techLevels={getUniqueTechLevels(entities)}
          sources={getUniqueSources(entities)}
        />
      )

      const links = container.querySelectorAll('a')
      expect(links.length).toBe(entities.length)
    })
  }

  it('renders filter buttons when multiple tech levels exist', () => {
    const firstSchema = entitySchemas[0]!
    const model = getModel(firstSchema.id)!
    const entities = model.all()

    const { container } = render(
      <SchemaViewerIsland
        initialData={entities}
        schemaId={firstSchema.id}
        techLevels={[1, 2, 3]}
        sources={['Core']}
      />
    )

    const filterButtons = container.querySelectorAll('button[aria-pressed]')
    expect(filterButtons.length).toBeGreaterThan(0)
  })

  it('shows an empty state with a clear-filters action when filters match nothing', () => {
    const firstSchema = entitySchemas[0]!
    const model = getModel(firstSchema.id)!
    const entities = model.all()

    render(
      <SchemaViewerIsland
        initialData={entities}
        schemaId={firstSchema.id}
        techLevels={[1, 2, 3]}
        sources={['Core', 'Rig', 'Nope']}
      />
    )

    // Click the FilterChip for 'Nope' — no entity carries this source, so the
    // grid should be empty and the empty-state message + clear button appear.
    const nopeChip = screen.getByRole('button', { name: 'Nope' })
    fireEvent.click(nopeChip)

    expect(screen.getByText('No items match the current filters.')).toBeTruthy()

    // Clicking "Clear filters" should restore entity cards.
    const clearBtn = screen.getByRole('button', { name: 'Clear filters' })
    fireEvent.click(clearBtn)

    const links = document.querySelectorAll('a[aria-label]')
    expect(links.length).toBe(entities.length)
  })
})
