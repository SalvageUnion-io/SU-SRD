/**
 * `/sheet/npc/:id` (ADR-043): the stat block as a user-made card, the
 * identity panel, and the crew slot it fills — editable for its owner,
 * read-only for a crewmate, down at 0 HP and never at max 0.
 */

import { afterAll, beforeEach, describe, expect, test } from 'bun:test'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ConnectionState } from '../../../lib/connection/connectionContext'
import { withSignedInBackend } from '../../../stores/__tests__/signedInBackend'
import { installConvexMocks, setQueryAnswers } from '../../__tests__/convexMock'
import { npcFixture } from '../../__tests__/fixtures'

// Module scope, before the imports below — see `convexMock.ts`.
const convexMocks = await installConvexMocks({
  convexClient: { mutation: async () => ({ updatedAt: 1 }) },
})
afterAll(() => convexMocks.restore())

const { ConnectionContext } = await import('../../../lib/connection/connectionContext')
const { useEntityStore } = await import('../../../stores/entityStore')
const { NpcSheet } = await import('../NpcSheet')

withSignedInBackend()

const CONNECTED: ConnectionState = {
  mode: 'connected',
  canWrite: true,
  showDisconnectedWarning: false,
  settling: false,
}

const KESSLER = npcFixture({
  id: 'n1',
  name: 'Sergeant Kessler',
  position: 'Union Quartermaster',
  actions: ['green-laser-rifle-veteran'],
  templateRef: { schema: 'npcs', slug: 'veteran' },
})

async function renderSheet(props: Partial<Parameters<typeof NpcSheet>[0]> = {}) {
  await act(async () => {
    render(
      <ConnectionContext.Provider value={CONNECTED}>
        <NpcSheet
          npc={KESSLER}
          madeBy="alxjrvs"
          readOnly={false}
          confirm={() => undefined}
          {...props}
        />
      </ConnectionContext.Provider>
    )
  })
}

beforeEach(async () => {
  useEntityStore.setState({
    npcs: [],
    hydrated: { pilots: true, mechs: true, crawlers: true, npcs: true, softLinks: true },
  })
  // Into the cache the way a synced row arrives, so an edit has a record to merge onto.
  await useEntityStore.getState().adopt('npc', KESSLER)
  setQueryAnswers({ 'games:listMine': [] })
})

describe('the sheet', () => {
  test('the stat block is the reference NPC card, user-made and credited', async () => {
    await renderSheet()
    expect(screen.getAllByText('NPC · from Veteran').length).toBeGreaterThan(0)
    expect(screen.getByText('Made by alxjrvs')).toBeTruthy()
    expect(screen.getAllByText('Green Laser Rifle (Veteran)').length).toBeGreaterThan(0)
  })

  test('its owner may move it or delete it', async () => {
    await renderSheet()
    expect(screen.getByRole('button', { name: 'Delete Sergeant Kessler' })).toBeTruthy()
    expect(screen.getByLabelText(/Move to a game or your shel/)).toBeTruthy()
  })

  test('a crewmate’s NPC is read-only and says so', async () => {
    await renderSheet({ readOnly: true, confirm: undefined, madeBy: 'Sam' })
    expect(screen.queryByRole('button', { name: 'Delete Sergeant Kessler' })).toBeNull()
    expect(screen.getByText(/You are reading a crewmate’s NPC/)).toBeTruthy()
    expect(screen.getByText('Made by Sam')).toBeTruthy()
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
    const edit = screen.getByRole('button', { name: /Edit Sergeant Kessler crew motto/ })
    await act(async () => {
      fireEvent.click(edit)
    })
    const input = screen.getByRole('textbox', { name: /Edit Sergeant Kessler crew motto/ })
    await act(async () => {
      fireEvent.change(input, { target: { value: 'Hold the line.' } })
      fireEvent.keyDown(input, { key: 'Enter' })
    })
    await waitFor(() => expect(useEntityStore.getState().npcs[0]?.motto).toBe('Hold the line.'))
  })
})
