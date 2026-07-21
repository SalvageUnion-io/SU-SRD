import { describe, it, expect, afterEach, spyOn } from 'bun:test'
import { render, within, fireEvent, screen, cleanup } from '@testing-library/react'
import {
  getEntitySchemas,
  getModel,
  getUniqueTechLevels,
  getUniqueSources,
  getUniqueTrees,
  getTechLevel,
  getTree,
} from 'salvageunion-reference'
import { SchemaViewerIsland } from '../SchemaViewerIsland'

const entitySchemas = getEntitySchemas()

/** Narrowing guard for fixture lookups — fails the test loudly instead of `!`. */
function required<T>(value: T | null | undefined, label: string): T {
  if (value == null) throw new Error(`Expected ${label} to exist`)
  return value
}

describe('SchemaViewerIsland', () => {
  // The island now reads/writes filter state to the URL. Reset the location
  // between tests so a leaked ?q=/?tl= doesn't silently filter later renders.
  // (happy-dom only reflects a location change from an href assignment, not from
  // a relative replaceState, so reset via href.)
  afterEach(() => {
    cleanup()
    window.location.href = 'http://localhost/'
  })

  it('renders FilterRow labels as visible text for filter sections', () => {
    // FilterRow renders a visible <span> label — old code used aria-label (not visible text)
    // Verifies FilterRow is used rather than the old manual div+role="group" pattern
    const firstSchema = required(entitySchemas[0], 'first entity schema')
    const model = required(getModel(firstSchema.id), `model for ${firstSchema.id}`)
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
    const filterRail = required(container.querySelector('aside'), 'the <aside> filter rail')
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
    const firstSchema = required(entitySchemas[0], 'first entity schema')
    const model = required(getModel(firstSchema.id), `model for ${firstSchema.id}`)
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

  it('name filter: typing a nonsense string shows the empty state', () => {
    const systemsModel = required(getModel('systems'), 'systems model')
    const entities = systemsModel.all()

    render(
      <SchemaViewerIsland
        initialData={entities}
        schemaId="systems"
        techLevels={getUniqueTechLevels(entities)}
        sources={getUniqueSources(entities)}
      />
    )

    const nameInput = screen.getByRole('searchbox', {
      name: 'Filter items by name',
    })
    fireEvent.change(nameInput, { target: { value: 'zzzznope' } })

    expect(screen.getByText('No items match the current filters.')).toBeTruthy()
    cleanup()
  })

  it('name filter: Clear-filters button clears name input and restores cards', () => {
    const systemsModel = required(getModel('systems'), 'systems model')
    const entities = systemsModel.all()

    render(
      <SchemaViewerIsland
        initialData={entities}
        schemaId="systems"
        techLevels={getUniqueTechLevels(entities)}
        sources={getUniqueSources(entities)}
      />
    )

    const nameInput = screen.getByRole('searchbox', {
      name: 'Filter items by name',
    })
    fireEvent.change(nameInput, { target: { value: 'zzzznope' } })

    expect(screen.getByText('No items match the current filters.')).toBeTruthy()

    const clearBtn = screen.getByRole('button', { name: 'Clear filters' })
    fireEvent.click(clearBtn)

    const links = document.querySelectorAll('a[aria-label]')
    expect(links.length).toBe(entities.length)
    cleanup()
  })

  it('name filter: typing a known entity name shows only matching cards', () => {
    const systemsModel = required(getModel('systems'), 'systems model')
    const entities = systemsModel.all()
    // ".50 Cal Machine Gun" is a known system — use a substring that is unique
    const knownName = '.50 Cal Machine Gun'

    render(
      <SchemaViewerIsland
        initialData={entities}
        schemaId="systems"
        techLevels={getUniqueTechLevels(entities)}
        sources={getUniqueSources(entities)}
      />
    )

    const nameInput = screen.getByRole('searchbox', {
      name: 'Filter items by name',
    })
    fireEvent.change(nameInput, { target: { value: knownName } })

    const links = document.querySelectorAll('a[aria-label]')
    const matching = entities.filter((e) => e.name.toLowerCase().includes(knownName.toLowerCase()))
    expect(links.length).toBe(matching.length)
    expect(links.length).toBeGreaterThan(0)
    cleanup()
  })

  it('shows an empty state with a clear-filters action when filters match nothing', () => {
    const firstSchema = required(entitySchemas[0], 'first entity schema')
    const model = required(getModel(firstSchema.id), `model for ${firstSchema.id}`)
    const entities = model.all()

    render(
      <SchemaViewerIsland
        initialData={entities}
        schemaId={firstSchema.id}
        techLevels={[1, 2, 3]}
        sources={['Core', 'Rig', 'Nope']}
      />
    )

    // Click the 'Nope' source filter chip — no entity carries this source, so the
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

  it('URL sync: initializes the name filter from ?q= on mount', () => {
    const systemsModel = required(getModel('systems'), 'systems model')
    const entities = systemsModel.all()
    const knownName = '.50 Cal Machine Gun'
    window.location.href = `http://localhost/schema/systems/?q=${encodeURIComponent(knownName)}`

    render(
      <SchemaViewerIsland
        initialData={entities}
        schemaId="systems"
        techLevels={getUniqueTechLevels(entities)}
        sources={getUniqueSources(entities)}
      />
    )

    const nameInput = screen.getByRole('searchbox', { name: 'Filter items by name' })
    expect((nameInput as HTMLInputElement).value).toBe(knownName)

    // Only the matching card(s) render — the shared view was restored.
    const links = document.querySelectorAll('a[aria-label]')
    const matching = entities.filter((e) => e.name.toLowerCase().includes(knownName.toLowerCase()))
    expect(links.length).toBe(matching.length)
    expect(links.length).toBeGreaterThan(0)
  })

  it('URL sync: initializes the tech-level filter from ?tl= on mount', () => {
    const systemsModel = required(getModel('systems'), 'systems model')
    const entities = systemsModel.all()
    const techLevels = getUniqueTechLevels(entities)
    // Pick a numeric tech level that partitions the dataset (some in, some out).
    const level = required(
      techLevels.find(
        (tl) =>
          typeof tl === 'number' && entities.some((e) => getTechLevel(e)?.toString() === String(tl))
      ),
      'a numeric tech level present in the dataset'
    )
    window.location.href = `http://localhost/schema/systems/?tl=${level}`

    render(
      <SchemaViewerIsland
        initialData={entities}
        schemaId="systems"
        techLevels={techLevels}
        sources={getUniqueSources(entities)}
      />
    )

    const links = document.querySelectorAll('a[aria-label]')
    const matching = entities.filter((e) => getTechLevel(e)?.toString() === String(level))
    expect(links.length).toBe(matching.length)
    expect(links.length).toBeGreaterThan(0)
    expect(links.length).toBeLessThan(entities.length)
  })

  it('tree filter: renders a Tree FilterRow only for the abilities schema', () => {
    const abilitiesModel = required(getModel('abilities'), 'abilities model')
    const entities = abilitiesModel.all()

    const { container } = render(
      <SchemaViewerIsland
        initialData={entities}
        schemaId="abilities"
        techLevels={getUniqueTechLevels(entities)}
        sources={getUniqueSources(entities)}
        trees={getUniqueTrees(entities)}
      />
    )

    const filterRail = required(container.querySelector('aside'), 'the <aside> filter rail')
    expect(within(filterRail).getByText('Tree')).toBeTruthy()
  })

  it('tree filter: clicking a tree chip shows only that tree’s abilities', () => {
    const abilitiesModel = required(getModel('abilities'), 'abilities model')
    const entities = abilitiesModel.all()
    const trees = getUniqueTrees(entities)
    // Pick a tree that partitions the dataset (some in, some out).
    const tree = required(trees[0], 'at least one ability tree')

    render(
      <SchemaViewerIsland
        initialData={entities}
        schemaId="abilities"
        techLevels={getUniqueTechLevels(entities)}
        sources={getUniqueSources(entities)}
        trees={trees}
      />
    )

    const treeChip = screen.getByRole('button', { name: tree })
    fireEvent.click(treeChip)

    const links = document.querySelectorAll('a[aria-label]')
    const matching = entities.filter((e) => getTree(e) === tree)
    expect(links.length).toBe(matching.length)
    expect(links.length).toBeGreaterThan(0)
    expect(links.length).toBeLessThan(entities.length)
    cleanup()
  })

  it('tree filter URL sync: initializes the tree filter from ?tree= on mount', () => {
    const abilitiesModel = required(getModel('abilities'), 'abilities model')
    const entities = abilitiesModel.all()
    const trees = getUniqueTrees(entities)
    const tree = required(trees[0], 'at least one ability tree')
    window.location.href = `http://localhost/schema/abilities/?tree=${encodeURIComponent(tree)}`

    render(
      <SchemaViewerIsland
        initialData={entities}
        schemaId="abilities"
        techLevels={getUniqueTechLevels(entities)}
        sources={getUniqueSources(entities)}
        trees={trees}
      />
    )

    const links = document.querySelectorAll('a[aria-label]')
    const matching = entities.filter((e) => getTree(e) === tree)
    expect(links.length).toBe(matching.length)
    expect(links.length).toBeGreaterThan(0)
    expect(links.length).toBeLessThan(entities.length)
  })

  it('URL sync: writes the name filter to the URL on change (replaceState)', () => {
    const systemsModel = required(getModel('systems'), 'systems model')
    const entities = systemsModel.all()
    window.location.href = 'http://localhost/schema/systems/'
    // Spy after mount so the initial (idempotent) sync doesn't count; assert the
    // change-driven write. happy-dom doesn't reflect a relative replaceState into
    // location, so verify the call argument rather than location.search.
    const replaceSpy = spyOn(window.history, 'replaceState')

    try {
      render(
        <SchemaViewerIsland
          initialData={entities}
          schemaId="systems"
          techLevels={getUniqueTechLevels(entities)}
          sources={getUniqueSources(entities)}
        />
      )

      const nameInput = screen.getByRole('searchbox', { name: 'Filter items by name' })
      fireEvent.change(nameInput, { target: { value: 'machine' } })

      const urls = replaceSpy.mock.calls.map((c) => String(c[2]))
      expect(urls.some((u) => u.includes('q=machine'))).toBe(true)
    } finally {
      replaceSpy.mockRestore()
    }
  })
})
