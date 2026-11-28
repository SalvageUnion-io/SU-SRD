/**
 * `/npcs/:id` (ADR-044): the stat block as a user-made card, the
 * identity panel, and the crew slot it fills — editable for its owner,
 * read-only for a crewmate, down at 0 HP and never at max 0.
 */

import { afterAll, beforeEach, describe, expect, test } from 'bun:test'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { npcFixture } from '../../../components/__tests__/fixtures'
import { installServerMocks, setQueryAnswers } from '../../../components/__tests__/serverMock'
import { withSignedInBackend } from '../../../replica/__tests__/signedInBackend'
import type { SyncState } from '../../../replica/syncContext'

// Module scope, before the imports below — see `serverMock.ts`.
const serverMocks = await installServerMocks()
afterAll(() => serverMocks.restore())

const { SyncContext } = await import('../../../replica/syncContext')
const { useUnits } = await import('../../../replica/units')
const { useEncounters } = await import('../../../replica/collections')
const { NpcSheet } = await import('../NpcSheet')

withSignedInBackend()

const CONNECTED: SyncState = {
  status: 'live',
  canWrite: true,
  outdated: false,
}

const KESSLER = npcFixture({
  id: 'n1',
  name: 'Sergeant Kessler',
  position: 'Union Quartermaster',
  actions: ['green-laser-rifle-veteran'],
  templateRef: { schema: 'npcs', slug: 'veteran' },
})

/** "Made by [maker]": the band's label-first chip (`MADE BY | Sam`). */
function madeBy(name: string) {
  return screen.getByText(name, { selector: '*' })
}

/** The corner's "⋯": Move and Delete live under it, as on every sheet. */
async function openMenu() {
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'More actions' }))
  })
}

async function renderSheet(props: Partial<Parameters<typeof NpcSheet>[0]> = {}) {
  await act(async () => {
    render(
      <SyncContext.Provider value={CONNECTED}>
        <NpcSheet
          npc={KESSLER}
          madeBy="alxjrvs"
          readOnly={false}
          confirm={() => undefined}
          {...props}
        />
      </SyncContext.Provider>
    )
  })
}

/** The sheet in Sheet view (`editing: false`) or Edit, as `LiveSheet`'s toggle sets it. */
async function renderInMode(editing: boolean) {
  const { SheetModeContext } = await import('../../sheet/sheetMode.model')
  await act(async () => {
    render(
      <SyncContext.Provider value={CONNECTED}>
        <SheetModeContext.Provider value={{ editing, setEditing: () => undefined } as never}>
          <NpcSheet npc={KESSLER} madeBy="alxjrvs" readOnly={false} confirm={() => undefined} />
        </SheetModeContext.Provider>
      </SyncContext.Provider>
    )
  })
}

beforeEach(async () => {
  useUnits.setState({
    npcs: [],
    hydrated: { pilots: true, mechs: true, crawlers: true, npcs: true, softLinks: true },
  })
  // Into the cache the way a synced row arrives, so an edit has a record to merge onto.
  await useUnits.getState().adopt('npc', KESSLER)
  setQueryAnswers({ 'games.listMine': [] })
})

describe('an NPC kept in a Game (MD2-14)', () => {
  async function renderInMode(npc = KESSLER) {
    const { SheetModeContext } = await import('../../sheet/sheetMode.model')
    await act(async () => {
      render(
        <SyncContext.Provider value={CONNECTED}>
          <SheetModeContext.Provider
            value={{ editing: false, setEditing: () => undefined } as never}
          >
            <NpcSheet npc={npc} madeBy="alxjrvs" readOnly={false} confirm={() => undefined} />
          </SheetModeContext.Provider>
        </SyncContext.Provider>
      )
    })
  }

  test('wears that Game on its band, and its way back is the Game’s Prep', async () => {
    setQueryAnswers({ 'games.listMine': [{ _id: 'g1', name: 'Rust Run', tableRunner: true }] })
    await renderInMode({ ...KESSLER, gameId: 'g1' })
    expect(screen.getByRole('link', { name: 'Game: Rust Run' }).getAttribute('href')).toBe(
      '/games/g1/prep'
    )
    expect(screen.getByRole('link', { name: 'Back to Game Prep' }).getAttribute('href')).toBe(
      '/games/g1/prep'
    )
    expect(screen.queryByRole('link', { name: 'Back to Mediator’s Kit' })).toBeNull()
  })

  test('in no Game, the way back is the Mediator’s Kit', async () => {
    await renderInMode()
    expect(screen.getByRole('link', { name: 'Back to Mediator’s Kit' })).toBeTruthy()
    expect(screen.queryByRole('link', { name: 'Back to Game Prep' })).toBeNull()
  })
})

describe('the sheet', () => {
  test('the band names it once, user-made, credited, and what it was built from', async () => {
    // Read: the band's h1 is the one place it is named (Edit adds a name field).
    await renderSheet({ readOnly: true, confirm: undefined })
    expect(screen.getAllByText('Sergeant Kessler')).toHaveLength(1)
    expect(screen.getByText('Homebrew')).toBeTruthy()
    expect(madeBy('alxjrvs')).toBeTruthy()
    expect(screen.getByText('Veteran')).toBeTruthy()
  })

  test('its actions are Minis under an Actions slab, their rules the book’s', async () => {
    await renderInMode(false)
    expect(screen.getAllByText('Green Laser Rifle (Veteran)').length).toBeGreaterThan(0)
  })

  test('its HP is the sheet’s one vital gauge, in full words', async () => {
    await renderInMode(false)
    expect(screen.getByText('Hit Points')).toBeTruthy()
  })

  test('its owner may move it or delete it', async () => {
    await renderSheet()
    await openMenu()
    expect(screen.getByRole('button', { name: 'Delete Sergeant Kessler' })).toBeTruthy()
    expect(screen.getByLabelText(/Move to a Game or your Training Bay/)).toBeTruthy()
  })

  // MD3-08: the confirm spoke of nothing the NPC was in, and its encounters kept it.
  test('Delete names the encounters that use it, and it leaves them', async () => {
    const now = '2026-11-21T00:00:00.000Z'
    useEncounters.setState({
      encounters: [
        {
          id: 'e1',
          schemaVersion: 1,
          name: 'The Relay',
          opposition: [
            {
              id: 'o1',
              refSchema: 'npcs',
              refSlug: '',
              name: 'Sergeant Kessler',
              maxHp: 4,
              statKind: 'hp',
              built: { npcId: 'n1', name: 'Sergeant Kessler', actions: [], traits: [] },
            },
          ],
          tables: [],
          notes: '',
          createdAt: now,
          updatedAt: now,
        },
      ],
      hydrated: true,
    } as never)
    const asked: Parameters<NonNullable<Parameters<typeof NpcSheet>[0]['confirm']>>[0][] = []
    let deleted = 0
    await renderSheet({ confirm: (request) => asked.push(request), onDeleted: () => deleted++ })
    await openMenu()
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Delete Sergeant Kessler' }))
    })
    await waitFor(() => expect(asked).toHaveLength(1))
    expect(asked[0]?.title).toBe('Delete Sergeant Kessler?')
    expect(asked[0]?.body).toEqual([
      'This cannot be undone. Sergeant Kessler will be removed from your Mediator’s Kit.',
      'Sergeant Kessler is in The Relay, and will be removed from it.',
    ])
    await act(async () => {
      await asked[0]?.onConfirm()
    })
    expect(useUnits.getState().npcs).toHaveLength(0)
    expect(useEncounters.getState().get('e1')?.opposition).toEqual([])
    expect(deleted).toBe(1)
  })

  test('its owner shares it with the Share button every player thing carries', async () => {
    setQueryAnswers({ 'games.listMine': [], 'publicSheet.get': null })
    await renderSheet()
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Share Sergeant Kessler' }))
    })
    expect(screen.getByRole('dialog')).toBeTruthy()
    expect(screen.getByText(/choose who can see sergeant kessler/i)).toBeTruthy()
    expect((screen.getByRole('radio', { name: /^public/i }) as HTMLInputElement).checked).toBe(
      false
    )
  })

  test('a read-only NPC has no corner actions, and says why when told', async () => {
    await renderSheet({
      readOnly: true,
      confirm: undefined,
      madeBy: 'Sam',
      readOnlyNote: 'You are reading a crewmate’s NPC.',
    })
    expect(screen.queryByRole('button', { name: 'Delete Sergeant Kessler' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Share Sergeant Kessler' })).toBeNull()
    expect(screen.getByText(/You are reading a crewmate’s NPC/)).toBeTruthy()
    expect(madeBy('Sam')).toBeTruthy()
  })

  test('the slot it crews is named, with its crawler', async () => {
    await renderSheet({
      crewing: {
        crawlerId: 'c1',
        crawlerName: '#430 Tenacity',
        slot: { kind: 'bay', bayRef: 'med-bay' },
      },
    })
    expect(screen.getByText(/Crews the Med Bay on/)).toBeTruthy()
    expect(screen.getByRole('link', { name: '#430 Tenacity' })).toBeTruthy()
  })
})

describe('down', () => {
  test('at 0 HP it is shown as down, and nothing is removed', async () => {
    await renderSheet({ npc: { ...KESSLER, currentHP: 0 } })
    expect(screen.getByText('Down')).toBeTruthy()
  })

  test('an NPC with no HP to lose is never down (the Augmented A.I.)', async () => {
    await renderSheet({ npc: { ...KESSLER, hitPoints: 0, currentHP: 0 } })
    expect(screen.queryByText('Down')).toBeNull()
  })
})

describe('edits', () => {
  test('a new motto saves to the NPC', async () => {
    await renderSheet()
    const edit = screen.getByRole('button', { name: /Edit sergeant kessler crew motto/ })
    await act(async () => {
      fireEvent.click(edit)
    })
    const input = screen.getByRole('textbox', { name: /Edit sergeant kessler crew motto/ })
    await act(async () => {
      fireEvent.change(input, { target: { value: 'Hold the line.' } })
      fireEvent.keyDown(input, { key: 'Enter' })
    })
    await waitFor(() => expect(useUnits.getState().npcs[0]?.motto).toBe('Hold the line.'))
  })
})

// MD2-03: Edit reached only the name and flavour. MD6-15: two Edits, one on the band.
describe('Redesign from a template', () => {
  // MD3-06: a fresh copy opens in Sheet view, where the door was missing.
  test('the ⋯ offers it in Edit and Sheet view, for an NPC designed as any NPC', async () => {
    const { SheetModeContext } = await import('../../sheet/sheetMode.model')
    const mode = (editing: boolean) => ({ editing, setEditing: () => undefined })
    const sheet = (editing: boolean, npc = KESSLER) => (
      <SyncContext.Provider value={CONNECTED}>
        <SheetModeContext.Provider value={mode(editing) as never}>
          <NpcSheet npc={npc} madeBy="alxjrvs" readOnly={false} confirm={() => undefined} />
        </SheetModeContext.Provider>
      </SyncContext.Provider>
    )
    let view!: ReturnType<typeof render>
    await act(async () => {
      view = render(sheet(false))
    })
    const design = () =>
      screen.queryByRole('link', { name: 'Redesign Sergeant Kessler from a template' })
    // Not on the band: under "⋯".
    expect(design()).toBeNull()
    await openMenu()
    expect(design()?.getAttribute('href')).toBe('/npcs/n1/design')
    await act(async () => {
      view.rerender(sheet(true))
    })
    expect(design()?.getAttribute('href')).toBe('/npcs/n1/design')
    // A crawler's crew take their stats from their slot: no designer for them here.
    await act(async () => {
      view.rerender(
        sheet(true, { ...KESSLER, templateRef: { schema: 'crawler-bays', slug: 'med-bay' } })
      )
    })
    expect(design()).toBeNull()
  })
})

describe('one Edit (r6 B12)', () => {
  async function renderEditing() {
    await renderInMode(true)
    await waitFor(() => expect(screen.getByLabelText(/Hit Points/)).toBeTruthy())
  }

  test('edits its stats: a new HP saves when the field is left', async () => {
    await renderEditing()
    const hp = screen.getByLabelText(/Hit Points/)
    await act(async () => {
      fireEvent.change(hp, { target: { value: '14' } })
    })
    expect(useUnits.getState().npcs[0]?.hitPoints).not.toBe(14)
    await act(async () => {
      fireEvent.blur(hp)
    })
    await waitFor(() => expect(useUnits.getState().npcs[0]?.hitPoints).toBe(14))
    // The rest of it stands: the name is the sheet's own field.
    expect(useUnits.getState().npcs[0]?.name).toBe('Sergeant Kessler')
  })

  test('edits its actions: setting one down saves at once', async () => {
    await renderEditing()
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Carry Green Laser Rifle (Veteran)' }))
    })
    await waitFor(() => expect(useUnits.getState().npcs[0]?.actions).toEqual([]))
  })

  test('Sheet view keeps the printed actions and no stat fields', async () => {
    await renderInMode(false)
    expect(screen.queryByLabelText(/Hit Points/)).toBeNull()
    expect(screen.queryByRole('button', { name: /^Carry / })).toBeNull()
  })
})
