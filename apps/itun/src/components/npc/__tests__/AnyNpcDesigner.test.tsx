/**
 * Board N1 — design an NPC from a reference template (issue 1277): the template
 * fills the stat block, the actions are the reference's behind checkboxes, the
 * preview wears the user-made treatment, and the save stores slugs.
 */

import { afterAll, beforeEach, describe, expect, test } from 'bun:test'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ConnectionState } from '../../../lib/connection/connectionContext'
import { withSignedInBackend } from '../../../stores/__tests__/signedInBackend'
import { installConvexMocks, setQueryAnswers } from '../../__tests__/convexMock'

const writes: unknown[] = []

// Module scope, before the imports below — see `convexMock.ts`.
const convexMocks = await installConvexMocks({
  convexClient: {
    mutation: async (_ref: unknown, args: unknown) => {
      writes.push(args)
      return { updatedAt: 1 }
    },
  },
})
afterAll(() => convexMocks.restore())

const { ConnectionContext } = await import('../../../lib/connection/connectionContext')
const { useEntityStore } = await import('../../../stores/entityStore')
const { AnyNpcDesigner } = await import('../AnyNpcDesigner')

withSignedInBackend()

const CONNECTED: ConnectionState = {
  mode: 'connected',
  canWrite: true,
  showDisconnectedWarning: false,
  settling: false,
}

let created: string[] = []

async function renderDesigner() {
  await act(async () => {
    render(
      <ConnectionContext.Provider value={CONNECTED}>
        <AnyNpcDesigner
          madeBy="alxjrvs"
          onCreated={(id) => created.push(id)}
          onCancel={() => undefined}
        />
      </ConnectionContext.Provider>
    )
  })
}

async function click(name: RegExp | string) {
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name }))
  })
}

beforeEach(() => {
  created = []
  writes.length = 0
  useEntityStore.setState({
    npcs: [],
    hydrated: { pilots: true, mechs: true, crawlers: true, npcs: true, softLinks: true },
  })
  setQueryAnswers({})
})

describe('the template step', () => {
  test('Next waits for a template or a blank start', async () => {
    await renderDesigner()
    expect(screen.getByRole('button', { name: 'Next: Stats' })).toHaveProperty('disabled', true)
    await click(/Start blank/)
    expect(screen.getByRole('button', { name: 'Next: Stats' })).toHaveProperty('disabled', false)
  })

  test('a reference NPC fills the stats and the actions', async () => {
    await renderDesigner()
    await click('Start from Veteran')
    await click('Next: Stats')
    expect(screen.getByLabelText(/Hit points/)).toHaveProperty('value', '9')
    await click('Next: Actions & traits')
    expect(
      screen.getByRole('checkbox', { name: 'Carry Green Laser Rifle (Veteran)' })
    ).toHaveProperty('checked', true)
    expect(
      screen.getByRole('checkbox', { name: 'Carry Portable Comms Unit (NPC)' })
    ).toHaveProperty('checked', true)
  })
})

describe('starting over', () => {
  async function editedVeteran() {
    await renderDesigner()
    await click('Start from Veteran')
    await click('Next: Stats')
    await act(async () => {
      fireEvent.change(screen.getByLabelText(/Hit points/), { target: { value: '12' } })
    })
    await click('Back')
  }

  test('Start blank asks first once the stats were edited, and clears them on yes', async () => {
    await editedVeteran()
    await click(/Start blank/)
    expect(screen.getAllByText('Start blank?').length).toBeGreaterThan(0)
    await click('Clear')
    await click('Next: Stats')
    expect(screen.getByLabelText(/Hit points/)).toHaveProperty('value', '')
  })

  test('declining the Start blank question keeps the edited stats', async () => {
    await editedVeteran()
    await click(/Start blank/)
    await click('Cancel')
    await click('Next: Stats')
    expect(screen.getByLabelText(/Hit points/)).toHaveProperty('value', '12')
  })

  test('Cancel on the first step asks before discarding a draft', async () => {
    await editedVeteran()
    await click('Cancel')
    expect(screen.getAllByText('Discard this draft?').length).toBeGreaterThan(0)
    await click('Keep editing')
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeTruthy()
  })
})

describe('the preview', () => {
  test('is the card as others will see it: User-made, from Veteran, made by you', async () => {
    await renderDesigner()
    await click('Start from Veteran')
    expect(screen.getAllByText('NPC · from Veteran').length).toBeGreaterThan(0)
    expect(screen.getAllByText('User-made').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Made by alxjrvs').length).toBeGreaterThan(0)
  })
})

describe('saving', () => {
  test('stores the carried actions as slugs, and only what the player wrote', async () => {
    await renderDesigner()
    await click('Start from Veteran')
    await click('Next: Stats')
    await click('Next: Actions & traits')
    await act(async () => {
      fireEvent.click(screen.getByRole('checkbox', { name: 'Carry Portable Comms Unit (NPC)' }))
    })
    await click('Next: Identity')
    expect(screen.getByRole('button', { name: 'Next: Review' })).toHaveProperty('disabled', true)
    await act(async () => {
      fireEvent.change(screen.getByLabelText(/Name/), { target: { value: 'Sergeant Kessler' } })
    })
    await click('Next: Review')
    await click('Save NPC')
    await waitFor(() => expect(useEntityStore.getState().npcs).toHaveLength(1))

    const [npc] = useEntityStore.getState().npcs
    expect(npc).toMatchObject({
      name: 'Sergeant Kessler',
      hitPoints: 9,
      damageType: 'HP',
      actions: ['green-laser-rifle-veteran'],
      templateRef: { schema: 'npcs', slug: 'veteran' },
    })
    // The template's own words pre-fill the description, and the player may edit them.
    expect(npc?.description).toContain('seasoned soldier')
    expect(created).toEqual([npc?.id ?? ''])
    // Server first: the body went up before it landed here.
    expect(writes).toContainEqual(expect.objectContaining({ table: 'npcs', appId: npc?.id }))
  })
})
