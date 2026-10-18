/**
 * Shelves — the paths `Roster.test.tsx` leaves open: the Showing toggle, the
 * Disconnected page that offers no writes, exporting a unit (and saying when
 * the download failed), the pattern shelf's verbs (open, copy, export,
 * delete, and "+ From a mech"), the personal encounter tray on the NPC shelf,
 * and the ⋯ menu's navigation verbs.
 *
 * Rendered without a router, so `useGo` falls back to `location.assign`,
 * which is observed; downloads are observed by intercepting the two browser
 * calls `downloadJson` makes. Both are restored after every test.
 */

import { afterAll, afterEach, beforeEach, describe, expect, spyOn, test } from 'bun:test'
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import type { EncounterNpc } from 'game-domain/schemas/encounterNpc'
import type { MechPattern } from 'game-domain/schemas/pattern'
import type { ConnectionState } from '../../../lib/connection/connectionContext'
import { withSignedInBackend } from '../../../stores/__tests__/signedInBackend'
import { installConvexMocks, setQueryAnswers } from '../../../components/__tests__/convexMock'
import { crawlerFixture, FIXTURE_NOW, mechFixture, pilotFixture } from '../../../components/__tests__/fixtures'

// Module scope, before the imports below — see `convexMock.ts`.
const convexMocks = await installConvexMocks({
  convexClient: { mutation: async () => ({ updatedAt: 1 }) },
})
afterAll(() => convexMocks.restore())

const { Toaster, toast } = await import('../../../components/index')
const { ConnectionContext } = await import('../../../lib/connection/connectionContext')
const { resetStores } = await import('../../../stores/__tests__/resetStores')
const { useEncounterStore } = await import('../../../stores/encounterStore')
const { useEntityStore } = await import('../../../stores/entityStore')
const { usePatternStore } = await import('../../../stores/patternStore')
const { Shelves } = await import('../Shelves')

withSignedInBackend()

function connection(mode: ConnectionState['mode']): ConnectionState {
  return {
    mode,
    canWrite: mode === 'connected',
    showDisconnectedWarning: false,
    settling: false,
  }
}

const NIA = pilotFixture({ id: 'p-nia', name: 'Nia Vale', gameId: null })
const ROOK = pilotFixture({ id: 'p-rook', name: 'Rook', gameId: 'g1' })
const IRON_JAW = mechFixture({ id: 'm-jaw', name: 'Iron Jaw', chassisRef: 'titan', gameId: null })

const BULWARK = crawlerFixture({ id: 'c-bulwark', name: 'Bulwark', gameId: null })
const TABLE_CRAWLER = crawlerFixture({ id: 'c-table', name: 'Table Crawler', gameId: 'g1' })

const PATTERN: MechPattern = {
  id: 'pat-1',
  schemaVersion: 1,
  name: 'Brawler',
  chassisRef: 'titan',
  systems: [],
  modules: [],
  cargoLots: [],
  createdAt: FIXTURE_NOW,
}

const GRUNT: EncounterNpc = {
  id: 'enc-1',
  schemaVersion: 1,
  gameId: null,
  refSchema: 'npcs',
  refSlug: 'veteran',
  refName: 'Veteran',
  name: 'Tray Grunt',
  currentHp: 9,
  maxHp: 9,
  statKind: 'hp',
  conditions: [],
  createdAt: FIXTURE_NOW,
  updatedAt: FIXTURE_NOW,
}

// --- observed browser calls ------------------------------------------------

type Download = { filename: string; blob: Blob }
let downloads: Download[] = []
let lastBlob: Blob | null = null
let failCreate = false
let assigned: string[] = []
let assignSpy: ReturnType<typeof spyOn> | null = null

const realCreate = URL.createObjectURL
const realRevoke = URL.revokeObjectURL
const realClick = HTMLAnchorElement.prototype.click

beforeEach(async () => {
  downloads = []
  lastBlob = null
  failCreate = false
  assigned = []
  URL.createObjectURL = (blob: Blob) => {
    if (failCreate) throw new Error('Disk full')
    lastBlob = blob
    return 'blob:test'
  }
  URL.revokeObjectURL = () => {}
  HTMLAnchorElement.prototype.click = function click(this: HTMLAnchorElement) {
    if (lastBlob !== null) downloads.push({ filename: this.download, blob: lastBlob })
  }
  assignSpy = spyOn(window.location, 'assign').mockImplementation((to: string | URL) => {
    assigned.push(String(to))
  })

  toast.dismiss()
  resetStores()
  setQueryAnswers({
    'games:listMine': [{ _id: 'g1', name: 'Tenacity', tableRunner: false }],
    'shelf:patternSharing': [],
    'shelf:sharedByLink': [],
  })
  const store = useEntityStore.getState()
  await store.adopt('pilot', NIA)
  await store.adopt('pilot', ROOK)
  await store.adopt('mech', IRON_JAW)
  await store.adopt('crawler', BULWARK)
  await store.adopt('crawler', TABLE_CRAWLER)
  usePatternStore.setState({ mechPatterns: [PATTERN], hydrated: true })
  useEncounterStore.setState({ encounterNpcs: [GRUNT], hydrated: true })
})

afterEach(() => {
  URL.createObjectURL = realCreate
  URL.revokeObjectURL = realRevoke
  HTMLAnchorElement.prototype.click = realClick
  assignSpy?.mockRestore()
  toast.dismiss()
})

// --- helpers ---------------------------------------------------------------

/** Drive the page's async hydrations to completion inside act(). */
async function settle(done: () => boolean): Promise<void> {
  for (let i = 0; i < 200 && !done(); i++) {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 5))
    })
  }
}

async function renderShelves(mode: ConnectionState['mode'] = 'connected') {
  await act(async () => {
    render(
      <ConnectionContext.Provider value={connection(mode)}>
        <Toaster />
        <Shelves />
      </ConnectionContext.Provider>
    )
  })
  await settle(() => screen.queryByRole('heading', { name: 'Pilots' }) !== null)
}

async function openMenu(name: string): Promise<HTMLElement> {
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: `More for ${name}` }))
  })
  return screen.getByRole('menu')
}

async function choose(menu: HTMLElement, item: string) {
  await act(async () => {
    fireEvent.click(within(menu).getByRole('menuitem', { name: item }))
  })
}

async function confirmDialog(button: string) {
  const dialog = screen.getByRole('alertdialog')
  await act(async () => {
    fireEvent.click(within(dialog).getByRole('button', { name: button }))
  })
}

async function downloadedJson(index = 0): Promise<Record<string, unknown>> {
  const d = downloads[index]
  if (d === undefined) throw new Error('nothing was downloaded')
  return JSON.parse(await d.blob.text()) as Record<string, unknown>
}

// --- tests -----------------------------------------------------------------

describe('Showing', () => {
  test('Unassigned hides what is in one, and says why a Hangar is empty', async () => {
    await renderShelves()
    const pilots = screen.getByRole('region', { name: 'Pilots' })
    expect(within(pilots).getByText('Rook')).toBeTruthy()
    expect(screen.getByText(/Tray Grunt/)).toBeTruthy()

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Unassigned' }))
    })
    expect(screen.getByRole('button', { name: 'Unassigned' }).getAttribute('aria-pressed')).toBe(
      'true'
    )
    expect(within(pilots).queryByText('Rook')).toBeNull()
    expect(within(pilots).getByText('Nia Vale')).toBeTruthy()
    // The personal tray is in no Game to filter by: it shows under Everything only.
    expect(screen.queryByText(/Tray Grunt/)).toBeNull()
  })

  test('a Hangar whose every unit is in a Game says so', async () => {
    await useEntityStore.getState().forget('pilot', 'p-nia')
    await renderShelves()
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Unassigned' }))
    })
    expect(screen.getByText('Every pilot is in a Game.')).toBeTruthy()
  })
})

describe('Crawlers', () => {
  test('a Game’s crawler is in your Hangar only where you run the table', async () => {
    await renderShelves()
    const crawlers = screen.getByRole('region', { name: 'Crawlers' })
    expect(within(crawlers).getByText('Bulwark')).toBeTruthy()
    expect(within(crawlers).queryByText('Table Crawler')).toBeNull()
  })

  test('as the table runner, the Game’s crawler is yours to keep', async () => {
    setQueryAnswers({
      'games:listMine': [{ _id: 'g1', name: 'Tenacity', tableRunner: true }],
      'shelf:patternSharing': [],
      'shelf:sharedByLink': [],
    })
    await renderShelves()
    const crawlers = screen.getByRole('region', { name: 'Crawlers' })
    expect(within(crawlers).getByText('Table Crawler')).toBeTruthy()
  })
})

describe('Disconnected', () => {
  test('shows what it holds, and offers nothing that writes', async () => {
    await renderShelves('disconnected')
    expect(screen.getByText('Nia Vale')).toBeTruthy()
    expect(screen.queryByRole('link', { name: '+ New pilot' })).toBeNull()
    expect(screen.queryByRole('button', { name: '+ From a mech' })).toBeNull()

    const menu = await openMenu('Nia Vale')
    for (const verb of ['Move to a Game…', 'Make a copy', 'Delete…']) {
      expect(within(menu).getByRole('menuitem', { name: verb }).hasAttribute('data-disabled')).toBe(
        true
      )
    }
    // Reading and exporting stay open.
    expect(
      within(menu).getByRole('menuitem', { name: 'Export' }).hasAttribute('data-disabled')
    ).toBe(false)
  })
})

describe('a unit’s ⋯ menu', () => {
  test('Export downloads the unit as a named file, and says so', async () => {
    await renderShelves()
    await choose(await openMenu('Nia Vale'), 'Export')
    await settle(() => downloads.length > 0)
    expect(downloads[0]?.filename).toBe('cantina-pilot-nia-vale.json')
    expect(await screen.findByText('Exported Nia Vale.')).toBeTruthy()
  })

  test('a failed export says so in a toast', async () => {
    failCreate = true
    await renderShelves()
    await choose(await openMenu('Nia Vale'), 'Export')
    expect(await screen.findByText('That export did not download. Try again.')).toBeTruthy()
    expect(downloads).toHaveLength(0)
  })

  test('Open goes to its sheet', async () => {
    await renderShelves()
    await choose(await openMenu('Nia Vale'), 'Open')
    expect(assigned).toEqual(['/sheet/pilot/p-nia'])
  })

  test('a mech’s Save as pattern opens the pattern designer from it', async () => {
    await renderShelves()
    await choose(await openMenu('Iron Jaw'), 'Save as pattern')
    expect(assigned).toEqual(['/mechs/patterns/new?from=m-jaw'])
  })
})

describe('Patterns', () => {
  test('+ From a mech lists the mechs to start from', async () => {
    await renderShelves()
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: '+ From a mech' }))
    })
    await act(async () => {
      fireEvent.click(screen.getByRole('menuitem', { name: 'Iron Jaw' }))
    })
    expect(assigned).toEqual(['/mechs/patterns/new?from=m-jaw'])
  })

  test('with no mechs, + From a mech says to build one first', async () => {
    await useEntityStore.getState().forget('mech', 'm-jaw')
    await renderShelves()
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: '+ From a mech' }))
    })
    expect(
      screen.getByRole('menuitem', { name: 'Build a mech first' }).hasAttribute('data-disabled')
    ).toBe(true)
  })

  test('Open goes to the pattern', async () => {
    await renderShelves()
    await choose(await openMenu('Brawler'), 'Open')
    expect(assigned).toEqual(['/p/pattern/pat-1'])
  })

  test('Make a copy asks first, then keeps a copy beside it', async () => {
    await renderShelves()
    await choose(await openMenu('Brawler'), 'Make a copy')
    expect(screen.getByRole('alertdialog').textContent).toContain('Make a copy of Brawler?')
    await confirmDialog('Make a copy')
    await settle(() => usePatternStore.getState().mechPatterns.length === 2)
    expect(
      usePatternStore
        .getState()
        .mechPatterns.map((p) => p.name)
        .sort()
    ).toEqual(['Brawler', 'COPY OF Brawler'])
    expect(await screen.findByText('Made COPY OF Brawler.')).toBeTruthy()
  })

  test('Export downloads the pattern', async () => {
    await renderShelves()
    await choose(await openMenu('Brawler'), 'Export')
    expect(downloads[0]?.filename).toBe('cantina-pattern-brawler.json')
    expect(JSON.stringify(await downloadedJson())).toContain('Brawler')
    expect(await screen.findByText('Exported Brawler.')).toBeTruthy()
  })

  test('Delete… asks, then removes it', async () => {
    await renderShelves()
    await choose(await openMenu('Brawler'), 'Delete…')
    await confirmDialog('Delete')
    await settle(() => usePatternStore.getState().mechPatterns.length === 0)
    expect(usePatternStore.getState().mechPatterns).toHaveLength(0)
  })
})

describe('the encounter tray on the NPC shelf', () => {
  test('a tray NPC is listed as such, and Delete… removes it from the tray', async () => {
    await renderShelves()
    const npcs = screen.getByRole('region', { name: 'NPCs' })
    expect(within(npcs).getByText(/Tray Grunt/)).toBeTruthy()
    expect(within(npcs).getByText('Tray')).toBeTruthy()

    await choose(await openMenu('Tray Grunt'), 'Delete…')
    await confirmDialog('Delete')
    await settle(() => useEncounterStore.getState().encounterNpcs.length === 0)
    expect(useEncounterStore.getState().encounterNpcs).toHaveLength(0)
  })
})
