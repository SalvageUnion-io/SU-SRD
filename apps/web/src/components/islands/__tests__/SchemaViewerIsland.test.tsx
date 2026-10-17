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
    const filterRail = required(container.querySelector<HTMLElement>('.su-rail'), 'the filter rail')
    expect(within(filterRail).getByRole('group', { name: 'Tech Level' })).toBeTruthy()
    expect(within(filterRail).getByRole('combobox', { name: 'Source' })).toBeTruthy()
  })

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
    window.location.href = `http://localhost/systems/?q=${encodeURIComponent(knownName)}`

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
    window.location.href = `http://localhost/systems/?tl=${level}`

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

    const filterRail = required(container.querySelector<HTMLElement>('.su-rail'), 'the filter rail')
    expect(within(filterRail).getByRole('combobox', { name: 'Tree' })).toBeTruthy()
  })

  it('draws each ability tree on its track: Rows numbered 1-2-3, a Legendary tree its "or"', () => {
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

    const trackOf = (tree: string) =>
      required(
        container.querySelector<HTMLElement>(
          `section[aria-label="${tree} Tree"] .su-ability-track`
        ),
        `${tree}'s track`
      )
    const forging = trackOf('Forging')
    expect(forging.dataset.track).toBe('core')
    expect(
      [...forging.querySelectorAll('.su-ability-track__tier .su-entity-row__tier')].map(
        (n) => n.textContent
      )
    ).toEqual(['1', '2', '3'])
    expect(trackOf('Advanced Engineer').dataset.track).toBe('advanced')
    expect(trackOf('Fabricator').dataset.track).toBe('hybrid')
    const legendary = trackOf('Legendary Engineer')
    expect(legendary.dataset.track).toBe('legendary')
    expect(legendary.querySelector('.su-ability-track__tier .su-entity-row__tier')).toBeNull()
    expect(legendary.querySelectorAll('.su-ability-track__or')).toHaveLength(1)
    // The Generic Abilities have no tiers and no order: plain rows, no track.
    expect(
      container.querySelector('section[aria-label="Generic Tree"] .su-ability-track')
    ).toBeNull()
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
    window.location.href = `http://localhost/abilities/?tree=${encodeURIComponent(tree)}`

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
    window.location.href = 'http://localhost/systems/'
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

  // Every listing is the Catalog: one flat grid of Tiles, no group headings,
  // at every width, with no toggle (`listingView.ts`).
  describe('the Catalog', () => {
    const chassisEntities = () => required(getModel('chassis'), 'chassis model').all()
    const renderChassis = () => {
      const entities = chassisEntities()
      return render(
        <SchemaViewerIsland
          schemaId="chassis"
          techLevels={getUniqueTechLevels(entities)}
          sources={getUniqueSources(entities)}
          hasArt
        />
      )
    }

    it('one art-first Tile per entity, in one flat grid with no group heading and no toggle', () => {
      const { container } = renderChassis()
      expect(container.querySelector('.su-listing[data-view="catalog"]')).toBeTruthy()
      expect(container.querySelector('.su-listing__cards')).toBeNull()
      const groups = container.querySelectorAll('.su-listing__group')
      expect(groups.length).toBe(1)
      expect(groups[0]?.getAttribute('aria-label')).toBeNull()
      const tiles = container.querySelectorAll('.su-listing__tiles > li > a.su-entity-tile')
      expect(tiles.length).toBe(chassisEntities().length)
      expect(container.querySelector('.su-rail__view')).toBeNull()
      expect(screen.queryByRole('button', { name: 'List' })).toBeNull()
      // Art from the su-assets 440 derivative, its box sized before it loads.
      // The opening row's art loads at once and first (it is the page's
      // largest paint); every tile after it, lazily.
      const imgs = [...container.querySelectorAll('.su-entity-tile__art img')]
      const img = required(imgs[0], 'a tile image')
      expect(img.getAttribute('src')).toMatch(
        /^https:\/\/assets\.salvageunion\.io\/.+-440q80\.webp$/
      )
      expect(imgs.map((el) => el.getAttribute('loading'))).toEqual(
        imgs.map((_, i) => (i < 4 ? 'eager' : 'lazy'))
      )
      expect(img.getAttribute('fetchpriority')).toBe('high')
      expect(imgs[4]?.getAttribute('fetchpriority')).toBeNull()
    })

    it('carries each entity’s lore under its cells', () => {
      const { container } = renderChassis()
      const gopher = required(
        container.querySelector<HTMLElement>('.su-listing__tiles a[aria-label="Gopher"]'),
        'the Gopher tile'
      )
      expect(gopher.querySelector('p')?.textContent).toStartWith(
        "The 'TC40' Gopher was originally designed"
      )
    })

    it('shows the filtered count and a removable token only while a filter is on', () => {
      const { container } = renderChassis()
      expect(container.querySelector('.su-rail__status')).toBeNull()
      fireEvent.click(screen.getByRole('button', { name: 'Tech Level 2' }))
      const status = required(container.querySelector('.su-rail__status'), 'the status line')
      const matching = chassisEntities().filter((e) => getTechLevel(e) === 2)
      expect(status.textContent).toContain(`${matching.length} of ${chassisEntities().length}`)
      expect(container.querySelectorAll('.su-listing__tiles > li').length).toBe(matching.length)
      fireEvent.click(screen.getByRole('button', { name: 'Remove Tech Level 2' }))
      expect(container.querySelector('.su-rail__status')).toBeNull()
    })

    it('a schema with no art takes the wider art-less columns', () => {
      const systems = required(getModel('systems'), 'systems model').all()
      const { container } = render(
        <SchemaViewerIsland
          schemaId="systems"
          techLevels={getUniqueTechLevels(systems)}
          sources={getUniqueSources(systems)}
        />
      )
      expect(container.querySelector('.su-listing[data-catalog]')).toBeTruthy()
      expect(container.querySelectorAll('.su-listing__tiles > li').length).toBe(systems.length)
    })

    it('a ?view=list or ?view=tree link elsewhere is ignored', () => {
      window.location.href = 'http://localhost/systems/?view=tree'
      const systems = required(getModel('systems'), 'systems model').all()
      const { container } = render(
        <SchemaViewerIsland
          schemaId="systems"
          techLevels={getUniqueTechLevels(systems)}
          sources={getUniqueSources(systems)}
        />
      )
      expect(container.querySelector('.su-listing[data-view="catalog"]')).toBeTruthy()
    })
  })

  // The abilities open on their Tree (each tree under its heading on its
  // track); their Catalog is flat, by name.
  describe('the abilities’ Tree', () => {
    const abilities = () => required(getModel('abilities'), 'abilities model').all()
    const renderAbilities = () =>
      render(
        <SchemaViewerIsland
          schemaId="abilities"
          techLevels={getUniqueTechLevels(abilities())}
          sources={getUniqueSources(abilities())}
          trees={getUniqueTrees(abilities())}
        />
      )

    it('offers Catalog | Tree and opens on the Tree', () => {
      const { container } = renderAbilities()
      const views = required(
        container.querySelector<HTMLElement>('.su-rail__view'),
        'the view toggle'
      )
      expect(
        within(views)
          .getAllByRole('button')
          .map((b) => b.textContent)
      ).toEqual(['Catalog', 'Tree'])
      expect(screen.getByRole('button', { name: 'Tree' }).getAttribute('aria-pressed')).toBe('true')
      expect(container.querySelector('section[aria-label="Forging Tree"]')).toBeTruthy()
    })

    it('the Catalog is one flat grid of Tiles, by name, under no tree heading', () => {
      const { container } = renderAbilities()
      fireEvent.click(screen.getByRole('button', { name: 'Catalog' }))
      expect(container.querySelector('.su-ability-track')).toBeNull()
      const groups = container.querySelectorAll('.su-listing__group')
      expect(groups.length).toBe(1)
      expect(groups[0]?.getAttribute('aria-label')).toBeNull()
      const names = [...container.querySelectorAll('.su-listing__tiles > li > a[aria-label]')].map(
        (tile) => tile.getAttribute('aria-label') ?? ''
      )
      expect(names.length).toBe(abilities().length)
      expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)))
    })

    it('remembers the choice, and a chosen view rides the URL', () => {
      const replaceSpy = spyOn(window.history, 'replaceState')
      try {
        renderAbilities()
        fireEvent.click(screen.getByRole('button', { name: 'Catalog' }))
        expect(window.localStorage.getItem('srd:listing-view:abilities')).toBe('catalog')
        const urls = replaceSpy.mock.calls.map((c) => String(c[2]))
        expect(urls.some((u) => u.includes('view=catalog'))).toBe(true)
      } finally {
        replaceSpy.mockRestore()
      }
      cleanup()
      window.localStorage.clear()
      window.location.href = 'http://localhost/abilities/?view=catalog'
      renderAbilities()
      expect(screen.getByRole('button', { name: 'Catalog' }).getAttribute('aria-pressed')).toBe(
        'true'
      )
    })
  })

  // The page hands the roll tables their top-level ids (`listingEntries`): the
  // island lists those, in one flat Catalog, each Tile with its lead.
  describe('the roll tables', () => {
    const tables = () => required(getModel('roll-tables'), 'roll-tables model').all()
    const listed = ['Core Mechanic', 'Callsign Table', 'Meteor Encounter']
    const renderTables = () => {
      const entryIds = tables()
        .filter((table) => listed.includes(table.name))
        .map((table) => table.id)
      return render(
        <SchemaViewerIsland
          schemaId="roll-tables"
          techLevels={[]}
          sources={getUniqueSources(tables())}
          entryIds={entryIds}
        />
      )
    }

    it('lists only the ids it is handed, with no book headings, each with its lead', () => {
      const { container } = renderTables()
      const tiles = [...container.querySelectorAll('.su-listing__tiles > li > a[aria-label]')]
      expect(tiles.map((tile) => tile.getAttribute('aria-label')).sort()).toEqual(
        [...listed].sort()
      )
      expect(container.querySelectorAll('.su-listing__group').length).toBe(1)
      for (const tile of tiles) expect(tile.querySelector('p')?.textContent).toBeTruthy()
      // The rail counts what the listing lists.
      expect(screen.queryByRole('searchbox', { name: 'Filter items by name' })).toBeNull()
    })
  })
})
