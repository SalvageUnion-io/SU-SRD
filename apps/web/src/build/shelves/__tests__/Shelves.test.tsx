/**
 * Shelves — the paths `Roster.test.tsx` leaves open: only your own units, the
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
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import type { EncounterNpc } from 'game-domain/schemas/encounterNpc'
import type { MechPattern } from 'game-domain/schemas/pattern'
import {
  crawlerFixture,
  FIXTURE_NOW,
  mechFixture,
  npcFixture,
  pilotFixture,
  softLinkFixture,
} from '../../../components/__tests__/fixtures'
import { installServerMocks, setQueryAnswers } from '../../../components/__tests__/serverMock'
import { areaAnchors } from '../../../components/unionBar/areaNav.model'
import { withSignedInBackend } from '../../../replica/__tests__/signedInBackend'
import { gameScope, serve } from '../../../replica/replica'
import { holdSharedByLink } from '../../../replica/sharedByLink'
import type { SyncState } from '../../../replica/syncContext'
import { serveTableState } from '../../../replica/tableState'

// Module scope, before the imports below — see `serverMock.ts`.
const serverMocks = await installServerMocks()
afterAll(() => serverMocks.restore())

const { ToasterMount, toast } = await import('../../../components/index')
const { SyncContext } = await import('../../../replica/syncContext')
const { resetStores } = await import('../../../replica/__tests__/resetStores')
const { useEncounters, useTray } = await import('../../../replica/collections')
const { useUnits } = await import('../../../replica/units')
const { usePatterns } = await import('../../../replica/collections')
const { Shelves } = await import('../Shelves')
const { ShelvesPart } = await import('../shelvesPart.model')

withSignedInBackend()

function connection(status: SyncState['status']): SyncState {
  return {
    status,
    canWrite: status === 'live',
    outdated: false,
  }
}

const NIA = pilotFixture({ id: 'p-nia', name: 'Nia Vale', gameId: null })
const ROOK = pilotFixture({ id: 'p-rook', name: 'Rook', gameId: 'g1' })
const IRON_JAW = mechFixture({ id: 'm-jaw', name: 'Iron Jaw', chassisRef: 'titan', gameId: null })

const BULWARK = crawlerFixture({ id: 'c-bulwark', name: 'Bulwark', gameId: null })
// Another Game's room serves these: none of them is yours.
const TABLE_CRAWLER = crawlerFixture({ id: 'c-table', name: 'Table Crawler', gameId: 'g2' })
const CREWMATE = pilotFixture({ id: 'p-mate', name: 'Crewmate Pilot', gameId: 'g2' })
const SPARE = mechFixture({ id: 'm-spare', name: 'Spare Mech', chassisRef: 'titan', gameId: 'g2' })

const PATTERN: MechPattern = {
  id: 'pat-1',
  schemaVersion: 1,
  name: 'Brawler',
  chassisRef: 'titan',
  systems: [],
  modules: [],
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
  setQueryAnswers({ 'games.listMine': [{ _id: 'g1', name: 'Tenacity', tableRunner: false }] })
  // The account room's snapshot: nothing shared yet.
  serveTableState('account', { sharing: [] })
  holdSharedByLink('account', [])
  const store = useUnits.getState()
  await store.adopt('pilot', NIA)
  await store.adopt('pilot', ROOK)
  await store.adopt('mech', IRON_JAW)
  await store.adopt('crawler', BULWARK)
  // The Game room's answer: a crewmate's pilot, an unassigned mech and the crew's crawler.
  serve(
    gameScope('g2'),
    ['pilot', 'mech', 'crawler'],
    [
      { table: 'pilot', row: CREWMATE, version: 1, owner: 'someone-else' },
      { table: 'mech', row: SPARE, version: 1, owner: null },
      { table: 'crawler', row: TABLE_CRAWLER, version: 1, owner: null },
    ]
  )
  usePatterns.setState({ mechPatterns: [PATTERN], hydrated: true })
  useTray.setState({ encounterNpcs: [GRUNT], hydrated: true })
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

/**
 * The Training Bay's shelves (`bay`), or the Mediator's Kit the Games front
 * draws from the same page (`kit`: NPCs and Encounters, ADR-066).
 */
async function renderShelves(
  status: SyncState['status'] = 'live',
  part: 'bay' | 'kit' | 'patterns' = 'bay'
) {
  await act(async () => {
    render(
      <SyncContext.Provider value={connection(status)}>
        <ToasterMount />
        <ShelvesPart.Provider value={part}>
          <Shelves />
        </ShelvesPart.Provider>
      </SyncContext.Provider>
    )
  })
  const first = part === 'kit' ? 'NPCs' : part === 'patterns' ? 'Patterns' : 'Pilots'
  await settle(() => screen.queryByRole('region', { name: first }) !== null)
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

describe('only what is yours', () => {
  test('lists your units, in a Game or not, and none of a Game’s that are not yours', async () => {
    await renderShelves()
    const pilots = screen.getByRole('region', { name: 'Pilots' })
    expect(within(pilots).getByText('Nia Vale')).toBeTruthy()
    expect(within(pilots).getByText('Rook')).toBeTruthy()
    expect(within(pilots).queryByText('Crewmate Pilot')).toBeNull()
    const mechs = screen.getByRole('region', { name: 'Mechs' })
    expect(within(mechs).queryByText('Spare Mech')).toBeNull()
    // The encounter tray is the Mediator's Kit, on the Games front.
    expect(screen.queryByText(/Tray Grunt/)).toBeNull()
  })

  test('has no Showing filter: a unit’s Game is its tag', async () => {
    await renderShelves()
    expect(screen.queryByLabelText('Showing')).toBeNull()
  })
})

describe('a unit’s Game', () => {
  test('is a link in its Game column, opening the Game’s page in Play; in no Game, none', async () => {
    await renderShelves()
    const pilots = screen.getByRole('region', { name: 'Pilots' })
    const games = [...pilots.querySelectorAll('a[href^="/games/"]')]
    expect(games.map((a) => [a.textContent, a.getAttribute('href')])).toEqual([
      ['Tenacity', '/games/g1'],
    ])
    expect(within(pilots).getByText('Tenacity').closest('tr')?.textContent).toContain('Rook')
    expect(within(pilots).queryByText('Unassigned')).toBeNull()
  })
})

describe('Play, one press from the shelf', () => {
  test('each pilot line carries its Play door, to that pilot’s Play mode', async () => {
    await renderShelves()
    const pilots = screen.getByRole('region', { name: 'Pilots' })
    expect(
      within(pilots).getByRole('link', { name: 'Open table as Nia Vale' }).getAttribute('href')
    ).toBe('/pilots/p-nia/play')
    expect(within(pilots).getByRole('link', { name: 'Open table as Rook' })).toBeTruthy()
    // Mechs play through their pilot: no door of their own.
    const mechs = screen.getByRole('region', { name: 'Mechs' })
    expect(within(mechs).queryByRole('link', { name: /^Open table/ })).toBeNull()
  })

  test('the Training Bay lists no Games: they are the Games tab’s (ADR-066)', async () => {
    await renderShelves()
    expect(screen.queryByRole('region', { name: 'Games' })).toBeNull()
  })
})

describe('Crawlers', () => {
  test('a Game’s crawler is in your Training Bay only where you run the table', async () => {
    await renderShelves()
    const crawlers = screen.getByRole('region', { name: 'Crawlers' })
    expect(within(crawlers).getByText('Bulwark')).toBeTruthy()
    expect(within(crawlers).queryByText('Table Crawler')).toBeNull()
  })

  test('as the table runner, the Game’s crawler is yours to keep; its crew’s units still are not', async () => {
    setQueryAnswers({
      'games.listMine': [
        { _id: 'g1', name: 'Tenacity', tableRunner: false },
        { _id: 'g2', name: 'Long Haul', tableRunner: true },
      ],
    })
    await renderShelves()
    const crawlers = screen.getByRole('region', { name: 'Crawlers' })
    expect(within(crawlers).getByText('Table Crawler')).toBeTruthy()
    const pilots = screen.getByRole('region', { name: 'Pilots' })
    expect(within(pilots).queryByText('Crewmate Pilot')).toBeNull()
  })
})

describe('What a shelf says of a unit (L9)', () => {
  test('a pilot’s line reads its class and its live HP and AP, a column each', async () => {
    await renderShelves()
    const pilots = screen.getByRole('region', { name: 'Pilots' })
    const columns = within(pilots)
      .getAllByRole('columnheader')
      .map((th) => th.textContent)
    // No pilot here has a mech: each line offers "+ Add a mech" (ADR-066 §4).
    expect(columns.slice(1, 6)).toEqual(['Class', 'Mech', 'Game', 'HP', 'AP'])
    const cells = within(within(pilots).getByText('Nia Vale').closest('tr') as HTMLElement)
      .getAllByRole('cell')
      .map((td) => td.textContent)
    // Its class, its mech (none: the door to add one), no Game, then HP and AP.
    expect(cells.slice(0, 5)).toEqual(['scavenger', '+ Add a Mech', '—', '10/10', '5/5'])
    const add = within(pilots).getAllByRole('link', { name: '+ Add a Mech' })[0]
    expect(add?.getAttribute('href')).toMatch(/\/mechs\/new\?pilot=/)
  })
})

describe('+ Add a Mech', () => {
  test('offers your unassigned mechs first, and assigns the one picked', async () => {
    await renderShelves()
    const pilots = screen.getByRole('region', { name: 'Pilots' })
    // Nia stands beside an unassigned mech of yours: her door opens the pick.
    await act(async () => {
      fireEvent.click(within(pilots).getByRole('button', { name: 'Add a Mech to Nia Vale' }))
    })
    const dialog = screen.getByRole('dialog', { name: 'Add a Mech to Nia Vale' })
    // Building a new one stays one press away.
    expect(
      within(dialog).getByRole('link', { name: '+ Build a new Mech' }).getAttribute('href')
    ).toBe('/mechs/new?pilot=p-nia')
    await act(async () => {
      fireEvent.click(within(dialog).getByRole('radio', { name: 'Iron Jaw' }))
    })
    await act(async () => {
      fireEvent.click(within(dialog).getByRole('button', { name: 'Assign' }))
    })
    await settle(() => useUnits.getState().softLinks.length === 1)
    expect(useUnits.getState().softLinks.map((l) => [l.type, l.from.id, l.to.id])).toEqual([
      ['mech-to-pilot', 'm-jaw', 'p-nia'],
    ])
    expect(await screen.findByText('Assigned Iron Jaw to Nia Vale.')).toBeTruthy()
  })

  test('with no unassigned mech beside the pilot, it is the link to build one', async () => {
    await renderShelves()
    const pilots = screen.getByRole('region', { name: 'Pilots' })
    // Rook is in a Game where no mech of yours stands: straight to the wizard.
    const row = within(pilots).getByText('Rook').closest('tr') as HTMLElement
    expect(within(row).getByRole('link', { name: '+ Add a Mech' }).getAttribute('href')).toBe(
      '/mechs/new?pilot=p-rook'
    )
  })
})

describe('a mech a pilot of yours flies', () => {
  test('rides its pilot’s line: the Mech column, and under the name for a phone', async () => {
    await useUnits.getState().adopt('softLink', softLinkFixture('mech-to-pilot', 'm-jaw', 'p-nia'))
    await renderShelves()
    const pilots = screen.getByRole('region', { name: 'Pilots' })
    const row = within(pilots).getByText('Nia Vale').closest('tr') as HTMLElement
    // The column (hidden on a phone) and the line under the name (shown only there).
    const links = within(row).getAllByRole('link', { name: 'Iron Jaw' })
    expect(links).toHaveLength(2)
    expect(row.querySelector('.su-shelf-ledger__flown')?.textContent).toBe('Mech Iron Jaw')
    // The Mechs shelf holds the rest.
    const mechs = screen.getByRole('region', { name: 'Mechs' })
    expect(within(mechs).queryByText('Iron Jaw')).toBeNull()
  })
})

describe('Homebrew on a shelf (ruleset §3.9, L9)', () => {
  test('the pattern and NPC shelves wear the one HOMEBREW stamp; a shelf of your units wears none', async () => {
    const stamped = (id: string) =>
      /homebrew/i.test(document.querySelector(`#${id} thead`)?.textContent ?? '')
    await renderShelves()
    expect(stamped('shelf-patterns')).toBe(true)
    expect(stamped('shelf-pilots')).toBe(false)
    expect(stamped('shelf-mechs')).toBe(false)
    cleanup()
    await renderShelves('live', 'kit')
    expect(stamped('shelf-npcs')).toBe(true)
  })
})

describe('Disconnected', () => {
  test('shows what it holds, and offers nothing that writes', async () => {
    await renderShelves('offline')
    expect(screen.getByText('Nia Vale')).toBeTruthy()
    expect(screen.queryByRole('link', { name: '+ New Pilot' })).toBeNull()
    expect(screen.queryByRole('button', { name: '+ From a Mech' })).toBeNull()

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
    expect(downloads[0]?.filename).toBe('salvageunion-pilot-nia-vale.json')
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
    expect(assigned).toEqual(['/pilots/p-nia'])
  })

  test('a mech’s Save as pattern opens its dialog over the Hangar', async () => {
    await renderShelves()
    await choose(await openMenu('Iron Jaw'), 'Save as pattern')
    const name = screen.getByRole('textbox', { name: 'Pattern name' }) as HTMLInputElement
    expect(name.value).toBe('Iron Jaw')
    expect(assigned).toEqual([])
  })
})

describe('Patterns', () => {
  test('+ From a mech lists the mechs to start from', async () => {
    await renderShelves()
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: '+ From a Mech' }))
    })
    expect(screen.queryByRole('menuitem', { name: 'Spare Mech' })).toBeNull()
    await act(async () => {
      fireEvent.click(screen.getByRole('menuitem', { name: 'Iron Jaw' }))
    })
    const name = screen.getByRole('textbox', { name: 'Pattern name' }) as HTMLInputElement
    expect(name.value).toBe('Iron Jaw')
    expect(assigned).toEqual([])
  })

  test('the Patterns page is this shelf alone: its rows, its menu and + From a Mech (r2 G5)', async () => {
    await renderShelves('live', 'patterns')
    expect(screen.queryByRole('region', { name: 'Pilots' })).toBeNull()
    expect(screen.queryByRole('region', { name: 'Mechs' })).toBeNull()
    const shelf = within(screen.getByRole('region', { name: 'Patterns' }))
    expect(shelf.getByRole('link', { name: 'Brawler' })).toBeTruthy()
    const menu = await openMenu('Brawler')
    expect(within(menu).getByRole('menuitem', { name: 'Build With This' })).toBeTruthy()
    expect(within(menu).getByRole('menuitem', { name: 'Delete…' })).toBeTruthy()
    await act(async () => {
      fireEvent.keyDown(menu, { key: 'Escape' })
    })
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: '+ From a Mech' }))
    })
    await act(async () => {
      fireEvent.click(screen.getByRole('menuitem', { name: 'Iron Jaw' }))
    })
    expect((screen.getByRole('textbox', { name: 'Pattern name' }) as HTMLInputElement).value).toBe(
      'Iron Jaw'
    )
  })

  test('Build With This asks once, makes the mech and lands on it (r2 G5)', async () => {
    await renderShelves()
    await choose(await openMenu('Brawler'), 'Build With This')
    await confirmDialog('Build')
    await settle(() => assigned.length > 0)
    const built = useUnits.getState().mechs.find((m) => m.name === 'Brawler')
    expect(built?.chassisRef).toBe('titan')
    expect(assigned).toEqual([`/mechs/${built?.id}`])
  })

  test('with no mechs, + From a mech says to build one first', async () => {
    await useUnits.getState().forget('mech', 'm-jaw')
    await renderShelves()
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: '+ From a Mech' }))
    })
    expect(
      screen.getByRole('menuitem', { name: 'Build a Mech first' }).hasAttribute('data-disabled')
    ).toBe(true)
  })

  test('Open goes to the pattern', async () => {
    await renderShelves()
    await choose(await openMenu('Brawler'), 'Open')
    expect(assigned).toEqual(['/p/pattern/pat-1'])
  })

  test('Make a copy copies at once, and its notice opens the copy', async () => {
    await renderShelves()
    await choose(await openMenu('Brawler'), 'Make a copy')
    // A copy only adds: nothing asks first.
    expect(screen.queryByRole('alertdialog')).toBeNull()
    await settle(() => usePatterns.getState().mechPatterns.length === 2)
    expect(
      usePatterns
        .getState()
        .mechPatterns.map((p) => p.name)
        .sort()
    ).toEqual(['Brawler', 'COPY OF Brawler'])
    expect(await screen.findByText('Copied Brawler.')).toBeTruthy()
    const copy = usePatterns.getState().mechPatterns.find((p) => p.name === 'COPY OF Brawler')
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Open the copy' }))
    })
    expect(assigned).toEqual([`/p/pattern/${copy?.id}`])
  })

  test('Export downloads the pattern', async () => {
    await renderShelves()
    await choose(await openMenu('Brawler'), 'Export')
    expect(downloads[0]?.filename).toBe('salvageunion-pattern-brawler.json')
    expect(JSON.stringify(await downloadedJson())).toContain('Brawler')
    expect(await screen.findByText('Exported Brawler.')).toBeTruthy()
  })

  test('Delete… asks, then removes it', async () => {
    await renderShelves()
    await choose(await openMenu('Brawler'), 'Delete…')
    await confirmDialog('Delete')
    await settle(() => usePatterns.getState().mechPatterns.length === 0)
    expect(usePatterns.getState().mechPatterns).toHaveLength(0)
  })
})

describe('the encounter tray on the NPC shelf', () => {
  test('a tray NPC is listed as such, and Delete… removes it from the tray', async () => {
    await renderShelves('live', 'kit')
    const npcs = screen.getByRole('region', { name: 'NPCs' })
    expect(within(npcs).getByText(/Tray Grunt/)).toBeTruthy()
    expect(within(npcs).getByText('Tray')).toBeTruthy()

    await choose(await openMenu('Tray Grunt'), 'Delete…')
    await confirmDialog('Delete')
    await settle(() => useTray.getState().encounterNpcs.length === 0)
    expect(useTray.getState().encounterNpcs).toHaveLength(0)
  })
})

// MD3-03: an earlier Game delete left its field in the Kit as loose Tray rows.
describe('rows left over from a deleted Game’s field', () => {
  const SECOND: EncounterNpc = { ...GRUNT, id: 'enc-2', name: 'Tray Mauler' }

  test('the Kit says what they are in one line, and Remove them asks first', async () => {
    useTray.setState({ encounterNpcs: [GRUNT, SECOND], hydrated: true })
    await renderShelves('live', 'kit')
    const npcs = screen.getByRole('region', { name: 'NPCs' })
    expect(
      within(npcs).getByText('The 2 units marked Tray were on the field of a Game deleted earlier.')
    ).toBeTruthy()
    await act(async () => {
      fireEvent.click(within(npcs).getByRole('button', { name: 'Remove them' }))
    })
    // Nothing is destroyed without the Mediator: the rows stand until confirmed.
    expect(useTray.getState().encounterNpcs).toHaveLength(2)
    const dialog = screen.getByRole('alertdialog')
    expect(dialog.textContent).toContain('Tray Grunt and Tray Mauler')
    await confirmDialog('Remove')
    await settle(() => useTray.getState().encounterNpcs.length === 0)
    expect(useTray.getState().encounterNpcs).toHaveLength(0)
    await settle(() => screen.queryByRole('button', { name: 'Remove them' }) === null)
    expect(screen.queryByText(/marked Tray/)).toBeNull()
  })

  test('one row reads in the singular; with none, there is no notice', async () => {
    await renderShelves('live', 'kit')
    expect(
      screen.getByText('The 1 unit marked Tray was on the field of a Game deleted earlier.')
    ).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Remove it' })).toBeTruthy()
    cleanup()
    useTray.setState({ encounterNpcs: [], hydrated: true })
    await renderShelves('live', 'kit')
    expect(screen.queryByText(/marked Tray/)).toBeNull()
  })

  test('where nothing can be written the line stands, with no button', async () => {
    await renderShelves('offline', 'kit')
    expect(screen.getByText(/marked Tray/)).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Remove it' })).toBeNull()
  })
})

// MD3-08: an NPC's delete spoke of crews and browsers, and left it in its encounters.
describe('deleting an NPC from the Kit', () => {
  test('the confirm names the encounters that use it, and it leaves them', async () => {
    const now = FIXTURE_NOW
    const vex = npcFixture({ id: 'n-vex', name: 'Warlord Vex', gameId: 'g1' })
    await act(async () => {
      await useUnits.getState().adopt('npc', vex)
    })
    const fielded = {
      id: 'o-vex',
      refSchema: 'npcs' as const,
      refSlug: '',
      name: 'Warlord Vex',
      maxHp: 6,
      statKind: 'hp' as const,
      built: { npcId: 'n-vex', name: 'Warlord Vex', actions: [], traits: [] },
    }
    const raider = { ...fielded, id: 'o-raider', refSlug: 'raider', name: 'Raider' }
    const { built: _built, ...bookRaider } = raider
    const encounter = (id: string, name: string, opposition: unknown[]) => ({
      id,
      schemaVersion: 1,
      name,
      opposition,
      tables: [],
      notes: '',
      createdAt: now,
      updatedAt: now,
    })
    useEncounters.setState({
      encounters: [
        encounter('e1', 'The Relay', [fielded, bookRaider]),
        encounter('e2', 'The Gap', [fielded]),
        encounter('e3', 'Elsewhere', [bookRaider]),
      ],
      hydrated: true,
    } as never)
    await renderShelves('live', 'kit')
    await choose(await openMenu('Warlord Vex'), 'Delete…')
    const dialog = screen.getByRole('alertdialog')
    expect(dialog.textContent).toContain(
      'Warlord Vex is in The Relay and The Gap, and will be removed from them.'
    )
    expect(dialog.textContent).not.toMatch(/crew|browser|for everyone/i)
    await confirmDialog('Delete')
    await settle(() => useUnits.getState().npcs.length === 0)
    await settle(() => useEncounters.getState().get('e2')?.opposition.length === 0)
    expect(useUnits.getState().npcs).toHaveLength(0)
    expect(useEncounters.getState().encounters.map((e) => e.opposition.map((o) => o.name))).toEqual(
      [['Raider'], [], ['Raider']]
    )
  })
})

// SB-07: every in-page link in Build's sub-nav has its target on the Training Bay.
describe('Build’s sub-nav', () => {
  test('each in-page link lands on a shelf', async () => {
    await renderShelves()
    const anchors = areaAnchors('build')
    expect(anchors.length).toBeGreaterThan(0)
    for (const id of anchors) expect(document.getElementById(id)).not.toBeNull()
  })
})
