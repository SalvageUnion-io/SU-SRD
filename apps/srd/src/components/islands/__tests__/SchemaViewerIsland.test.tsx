import { afterEach, describe, expect, it, spyOn } from 'bun:test'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import {
  getEntitySchemas,
  getModel,
  getTechLevel,
  getTree,
  getUniqueSources,
  getUniqueTechLevels,
  getUniqueTrees,
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

  it("names the rail's facets: the Tech Level toggle and the Source menu", () => {
    const firstSchema = required(entitySchemas[0], 'first entity schema')

    const { container } = render(
      <SchemaViewerIsland
        schemaId={firstSchema.id}
        techLevels={[1, 2, 3]}
        sources={['Core', 'Rig']}
      />
    )

    // Scope to the rail: entity cards also surface a "Tech Level" cell in the grid.
    const filterRail = required(
      container.querySelector<HTMLElement>('.srd-rail'),
      'the filter rail'
    )
    expect(within(filterRail).getByRole('group', { name: 'Tech Level' })).toBeTruthy()
    expect(within(filterRail).getByRole('combobox', { name: 'Source' })).toBeTruthy()
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

  it('renders filter buttons when multiple tech levels exist', () => {
    const firstSchema = required(entitySchemas[0], 'first entity schema')

    const { container } = render(
      <SchemaViewerIsland schemaId={firstSchema.id} techLevels={[1, 2, 3]} sources={['Core']} />
    )

    const filterButtons = container.querySelectorAll('button[aria-pressed]')
    expect(filterButtons.length).toBeGreaterThan(0)
  })

  it('name filter: typing a nonsense string shows the empty state', () => {
    const systemsModel = required(getModel('systems'), 'systems model')
    const entities = systemsModel.all()

    render(
      <SchemaViewerIsland
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
        schemaId={firstSchema.id}
        techLevels={[1, 2, 3]}
        sources={['Core', 'Rig', 'Nope']}
      />
    )

    // Pick the 'Nope' source — no entity carries it, so the grid empties and
    // the empty-state message + clear button appear.
    fireEvent.change(screen.getByRole('combobox', { name: 'Source' }), {
      target: { value: 'Nope' },
    })

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
        schemaId="systems"
        techLevels={getUniqueTechLevels(entities)}
        sources={getUniqueSources(entities)}
      />
    )

    const nameInput = screen.getByRole('searchbox', { name: 'Filter items by name' })
    if (!(nameInput instanceof HTMLInputElement)) throw new Error('expected an <input> searchbox')
    expect(nameInput.value).toBe(knownName)

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

  it('tree filter: renders a Tree menu for the abilities schema', () => {
    const abilitiesModel = required(getModel('abilities'), 'abilities model')
    const entities = abilitiesModel.all()

    const { container } = render(
      <SchemaViewerIsland
        schemaId="abilities"
        techLevels={getUniqueTechLevels(entities)}
        sources={getUniqueSources(entities)}
        trees={getUniqueTrees(entities)}
      />
    )

    const filterRail = required(
      container.querySelector<HTMLElement>('.srd-rail'),
      'the filter rail'
    )
    expect(within(filterRail).getByRole('combobox', { name: 'Tree' })).toBeTruthy()
  })

  it('tree filter: picking a tree shows only that tree’s abilities', () => {
    const abilitiesModel = required(getModel('abilities'), 'abilities model')
    const entities = abilitiesModel.all()
    const trees = getUniqueTrees(entities)
    // Pick a tree that partitions the dataset (some in, some out).
    const tree = required(trees[0], 'at least one ability tree')

    render(
      <SchemaViewerIsland
        schemaId="abilities"
        techLevels={getUniqueTechLevels(entities)}
        sources={getUniqueSources(entities)}
        trees={trees}
      />
    )

    fireEvent.change(screen.getByRole('combobox', { name: 'Tree' }), { target: { value: tree } })

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

  // The listing's default is one compact card per entity (ruleset §1,
  // Listing); the Catalog toggle swaps in the artwork tiles.
  describe('the listing (Rows in link mode)', () => {
    const chassisEntities = () => required(getModel('chassis'), 'chassis model').all()
    const renderChassis = () => {
      const entities = chassisEntities()
      return render(
        <SchemaViewerIsland
          schemaId="chassis"
          techLevels={getUniqueTechLevels(entities)}
          sources={getUniqueSources(entities)}
        />
      )
    }

    it('one Row per entity, each a named link, in an entity grid', () => {
      const { container } = renderChassis()
      expect(container.querySelector('.srd-listing__cards[data-entity-grid]')).toBeTruthy()
      const rows = container.querySelectorAll('.srd-listing__cards > li > a[aria-label]')
      expect(rows.length).toBe(chassisEntities().length)
    })

    it('groups the list by tech level, each group under its slab, with no TL cell on the cards', () => {
      const { container } = renderChassis()
      const groups = container.querySelectorAll('.srd-listing__group')
      const levels = new Set(chassisEntities().map((e) => String(getTechLevel(e))))
      expect(groups.length).toBe(levels.size)
      expect(groups[0]?.getAttribute('aria-label')).toBe('Tech Level 1')
      // The group heading says the tech level, so no card repeats it.
      expect(
        within(container.querySelector('.srd-listing__cards') as HTMLElement).queryByText('TL')
      ).toBeNull()
    })

    it('carries each entity’s lore under its cells', () => {
      const { container } = renderChassis()
      const gopher = required(
        container.querySelector<HTMLElement>('.srd-listing__cards a[aria-label="Gopher"]'),
        'the Gopher card'
      )
      expect(gopher.querySelector('p')?.textContent).toStartWith(
        "The 'TC40' Gopher was originally designed"
      )
    })

    it('shows the filtered count and a removable token only while a filter is on', () => {
      const { container } = renderChassis()
      expect(container.querySelector('.srd-rail__status')).toBeNull()
      fireEvent.click(screen.getByRole('button', { name: 'Tech Level 2' }))
      const status = required(container.querySelector('.srd-rail__status'), 'the status line')
      const matching = chassisEntities().filter((e) => getTechLevel(e) === 2)
      expect(status.textContent).toContain(`${matching.length} of ${chassisEntities().length}`)
      fireEvent.click(screen.getByRole('button', { name: 'Remove Tech Level 2' }))
      expect(container.querySelector('.srd-rail__status')).toBeNull()
    })

    it('the catalog view is retired: an old ?view=catalog link shows the list', () => {
      window.location.href = 'http://localhost/schema/chassis/?view=catalog'
      const replaceSpy = spyOn(window.history, 'replaceState')
      try {
        const { container } = renderChassis()
        expect(screen.queryByRole('button', { name: 'Catalog' })).toBeNull()
        expect(container.querySelector('.srd-listing__cards')).toBeTruthy()
        expect(container.querySelectorAll('a[aria-label]').length).toBe(chassisEntities().length)
        const urls = replaceSpy.mock.calls.map((c) => String(c[2]))
        expect(urls.some((u) => u.includes('view='))).toBe(false)
      } finally {
        replaceSpy.mockRestore()
      }
    })
  })
})
