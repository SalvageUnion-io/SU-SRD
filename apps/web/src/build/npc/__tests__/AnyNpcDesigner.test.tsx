/**
 * The NPC designer — design an NPC from a reference template: the template
 * fills the stat block, the actions are the reference's behind checkboxes, the
 * preview wears the user-made treatment, and the save stores slugs.
 */

import { afterAll, beforeEach, describe, expect, test } from 'bun:test'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { acceptingRooms, roomActs } from '../../../../test/roomsStub'
import { npcFixture } from '../../../components/__tests__/fixtures'
import { installServerMocks, setQueryAnswers } from '../../../components/__tests__/serverMock'
import { withSignedInBackend } from '../../../replica/__tests__/signedInBackend'
import type { SyncState } from '../../../replica/syncContext'

// Module scope, before the imports below — see `serverMock.ts`.
const serverMocks = await installServerMocks()
afterAll(() => serverMocks.restore())

const { SyncContext } = await import('../../../replica/syncContext')
const { useUnits } = await import('../../../replica/units')
const { AnyNpcDesigner, NpcRedesigner } = await import('../AnyNpcDesigner')
const { useEncounters } = await import('../../../replica/collections')

withSignedInBackend()

const CONNECTED: SyncState = {
  status: 'live',
  canWrite: true,
  outdated: false,
}

let created: string[] = []

async function renderDesigner() {
  await act(async () => {
    render(
      <SyncContext.Provider value={CONNECTED}>
        <AnyNpcDesigner
          madeBy="alxjrvs"
          onCreated={(id) => created.push(id)}
          onCancel={() => undefined}
        />
      </SyncContext.Provider>
    )
  })
}

async function click(name: RegExp | string) {
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name }))
  })
}

/** Pick a template, or Start blank: one choice, so each is a radio (hard rule R15). */
async function pick(name: string) {
  await act(async () => {
    fireEvent.click(screen.getByRole('radio', { name }))
  })
}

beforeEach(() => {
  created = []
  acceptingRooms()
  useUnits.setState({
    npcs: [],
    hydrated: { pilots: true, mechs: true, crawlers: true, npcs: true, softLinks: true },
  })
  setQueryAnswers({})
})

describe('the template step', () => {
  test('is one choice: a radio group, the pick ringed and sealed "Selected"', async () => {
    await renderDesigner()
    expect(screen.getByRole('radiogroup', { name: 'Template' })).toBeTruthy()
    expect(screen.queryAllByRole('checkbox')).toHaveLength(0)
    expect(screen.queryByText('Selected')).toBeNull()
    await pick('Start from Veteran')
    expect(
      screen.getByRole('radio', { name: 'Start from Veteran' }).getAttribute('aria-checked')
    ).toBe('true')
    expect(screen.getAllByText('Selected')).toHaveLength(1)
    await pick('Start blank')
    expect(screen.getByRole('radio', { name: 'Start blank' }).getAttribute('aria-checked')).toBe(
      'true'
    )
    expect(screen.getAllByText('Selected')).toHaveLength(1)
  })

  test('Next waits for a template or a blank start', async () => {
    await renderDesigner()
    expect(screen.getByRole('button', { name: 'Next: Stats' })).toHaveProperty('disabled', true)
    await pick('Start blank')
    expect(screen.getByRole('button', { name: 'Next: Stats' })).toHaveProperty('disabled', false)
  })

  test('a reference NPC fills the stats and the actions', async () => {
    await renderDesigner()
    await pick('Start from Veteran')
    await click('Next: Stats')
    expect(screen.getByLabelText(/Hit Points/)).toHaveProperty('value', '9')
    await click('Next: Actions & traits')
    expect(
      screen
        .getByRole('button', { name: 'Carry Green Laser Rifle (Veteran)' })
        .getAttribute('aria-pressed')
    ).toBe('true')
    expect(
      screen
        .getByRole('button', { name: 'Carry Portable Comms Unit (NPC)' })
        .getAttribute('aria-pressed')
    ).toBe('true')
  })
})

describe('adding a trait', () => {
  test('names a lower-case glossary trait as the book prints it', async () => {
    await renderDesigner()
    await pick('Start from Veteran')
    await click('Next: Stats')
    await click('Next: Actions & traits')
    await act(async () => {
      fireEvent.change(screen.getByPlaceholderText('Add an action or trait from the reference'), {
        target: { value: 'vulnerable' },
      })
    })
    await click(/^Add Vulnerable/)
    expect(screen.getByRole('button', { name: 'Carry Vulnerable' })).toBeTruthy()
  })
})

describe('starting over', () => {
  async function editedVeteran() {
    await renderDesigner()
    await pick('Start from Veteran')
    await click('Next: Stats')
    await act(async () => {
      fireEvent.change(screen.getByLabelText(/Hit Points/), { target: { value: '12' } })
    })
    await click('Back')
  }

  test('Start blank asks first once the stats were edited, and clears them on yes', async () => {
    await editedVeteran()
    await pick('Start blank')
    expect(screen.getAllByText('Start blank?').length).toBeGreaterThan(0)
    await click('Clear')
    await click('Next: Stats')
    expect(screen.getByLabelText(/Hit Points/)).toHaveProperty('value', '')
  })

  test('declining the Start blank question keeps the edited stats', async () => {
    await editedVeteran()
    await pick('Start blank')
    await click('Cancel')
    await click('Next: Stats')
    expect(screen.getByLabelText(/Hit Points/)).toHaveProperty('value', '12')
  })

  test('Cancel on the first step asks before discarding a draft', async () => {
    await editedVeteran()
    await click('Cancel')
    expect(screen.getAllByText('Discard this draft?').length).toBeGreaterThan(0)
    await click('Keep editing')
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeTruthy()
  })
})

describe('any Reference denizen is a template (MD-09)', () => {
  test('a kind tab lists it, and a Bio-Titan fills its Structure Points as SP', async () => {
    await renderDesigner()
    // Book NPCs first; another kind is one press away.
    expect(screen.queryByRole('radio', { name: 'Start from Scylla' })).toBeNull()
    await click('Bio-Titans')
    await pick('Start from Scylla')
    expect(screen.getAllByText('From Scylla').length).toBeGreaterThan(0)
    await click('Next: Stats')
    expect(screen.getByLabelText(/Hit Points/)).not.toHaveProperty('value', '')
  })

  test('a search reads every kind at once', async () => {
    await renderDesigner()
    await act(async () => {
      fireEvent.change(screen.getByLabelText('Find a template'), { target: { value: 'scylla' } })
    })
    expect(screen.getByRole('radio', { name: 'Start from Scylla' })).toBeTruthy()
  })
})

describe('the preview', () => {
  test('is the card as others will see it: Homebrew, from Veteran, made by you', async () => {
    await renderDesigner()
    await pick('Start from Veteran')
    expect(screen.getAllByText('From Veteran').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Homebrew').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Made by alxjrvs').length).toBeGreaterThan(0)
  })
})

describe('saving', () => {
  test('stores the carried actions as slugs, and only what the player wrote', async () => {
    await renderDesigner()
    await pick('Start from Veteran')
    await click('Next: Stats')
    await click('Next: Actions & traits')
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Carry Portable Comms Unit (NPC)' }))
    })
    await click('Next: Identity')
    expect(screen.getByRole('button', { name: 'Next: Review' })).toHaveProperty('disabled', true)
    await act(async () => {
      fireEvent.change(screen.getByLabelText(/Name/), { target: { value: 'Sergeant Kessler' } })
    })
    await click('Next: Review')
    await click('Save NPC')
    await waitFor(() => expect(useUnits.getState().npcs).toHaveLength(1))

    const [npc] = useUnits.getState().npcs
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
    expect(roomActs).toContainEqual({
      gameId: null,
      name: 'createUnit',
      args: expect.objectContaining({ id: npc?.id, kind: 'npc' }),
    })
  })
})

// MD2-21: Review drew the finished card beside the live preview of the same card.
describe('the review step', () => {
  test('shows the card once', async () => {
    await renderDesigner()
    await pick('Start blank')
    await click('Next: Stats')
    await act(async () => {
      fireEvent.change(screen.getByLabelText(/Hit Points/), { target: { value: '5' } })
    })
    await click('Next: Actions & traits')
    await click('Next: Identity')
    await act(async () => {
      fireEvent.change(screen.getByLabelText(/Name/), { target: { value: 'Vex' } })
    })
    // Beside a step, the live preview; on Review, the card alone.
    expect(screen.getByRole('region', { name: 'Live preview' })).toBeTruthy()
    await click('Next: Review')
    expect(screen.queryByRole('region', { name: 'Live preview' })).toBeNull()
    expect(screen.getAllByText('Made by alxjrvs')).toHaveLength(1)
  })
})

// MD2-03: a saved NPC could not be changed beyond its name and flavour.
describe('redesigning a saved NPC', () => {
  const VEX = npcFixture({
    id: 'n-vex',
    name: 'Captain Vex',
    position: 'Raider warlord',
    hitPoints: 6,
    actions: ['green-laser-rifle-veteran'],
    templateRef: { schema: 'npcs', slug: 'veteran' },
  })
  const NOW = '2026-11-21T00:00:00.000Z'
  const built = { npcId: 'n-vex', name: 'Captain Vex', actions: VEX.actions, traits: [] }
  const opponent = (id: string, name: string) => ({
    id,
    refSchema: 'npcs' as const,
    refSlug: '',
    name,
    maxHp: 6,
    statKind: 'hp' as const,
    built,
  })
  let saved: string[] = []

  async function renderRedesign() {
    await useUnits.getState().adopt('npc', VEX)
    useEncounters.setState({
      encounters: [
        {
          id: 'enc-1',
          schemaVersion: 1,
          name: 'Ambush',
          opposition: [opponent('o1', 'Captain Vex'), opponent('o2', 'Red Leader')],
          tables: [],
          notes: '',
          createdAt: NOW,
          updatedAt: NOW,
        },
      ],
      hydrated: true,
    } as never)
    saved = []
    await act(async () => {
      render(
        <SyncContext.Provider value={CONNECTED}>
          <NpcRedesigner
            npc={VEX}
            madeBy="alxjrvs"
            onSaved={(id) => saved.push(id)}
            onCancel={() => undefined}
          />
        </SyncContext.Provider>
      )
    })
  }

  test('opens on its stats as they stand, with no Template step', async () => {
    await renderRedesign()
    expect(screen.getByLabelText(/Hit Points/)).toHaveProperty('value', '6')
    expect(screen.queryByRole('radiogroup', { name: 'Template' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Change the template' })).toBeNull()
    await click('Next: Actions & traits')
    expect(
      screen
        .getByRole('button', { name: 'Carry Green Laser Rifle (Veteran)' })
        .getAttribute('aria-pressed')
    ).toBe('true')
  })

  test('saves onto the same NPC, and every encounter that fields it takes the change', async () => {
    await renderRedesign()
    await act(async () => {
      fireEvent.change(screen.getByLabelText(/Hit Points/), { target: { value: '12' } })
    })
    await click('Next: Actions & traits')
    await click('Next: Identity')
    await act(async () => {
      fireEvent.change(screen.getByLabelText(/Name/), { target: { value: 'Warlord Vex' } })
      fireEvent.change(screen.getByLabelText(/Position/), { target: { value: '' } })
    })
    await click('Next: Review')
    await click('Save changes')
    await waitFor(() => expect(saved).toEqual(['n-vex']))

    // In place: still one NPC, the same id.
    const npcs = useUnits.getState().npcs
    expect(npcs).toHaveLength(1)
    expect(npcs[0]).toMatchObject({ id: 'n-vex', name: 'Warlord Vex', hitPoints: 12 })
    expect(npcs[0]?.position).toBeUndefined()
    expect(roomActs.some((a) => a.name === 'createUnit')).toBe(false)

    const opposition = useEncounters.getState().get('enc-1')?.opposition ?? []
    expect(opposition.map((o) => [o.name, o.maxHp, o.built?.name])).toEqual([
      ['Warlord Vex', 12, 'Warlord Vex'],
      // One the Mediator named apart keeps its name.
      ['Red Leader', 12, 'Warlord Vex'],
    ])
  })
  // MD3-06: a finished NPC walked every step to change one field.
  test('every step is a way in from the start, and each one saves', async () => {
    await renderRedesign()
    const rail = within(screen.getByRole('navigation', { name: 'Steps' }))
    for (const step of ['Actions & traits', 'Identity', 'Review']) {
      expect(rail.getByRole('button', { name: step })).toHaveProperty('disabled', false)
    }
    // Straight to the name, passing no other step, and saved from there.
    await act(async () => {
      fireEvent.click(rail.getByRole('button', { name: 'Identity' }))
    })
    await act(async () => {
      fireEvent.change(screen.getByLabelText(/Name/), { target: { value: 'Warlord Vex' } })
    })
    expect(screen.getByRole('button', { name: 'Next: Review' })).toBeTruthy()
    await click('Save changes')
    await waitFor(() => expect(saved).toEqual(['n-vex']))
    expect(useUnits.getState().npcs[0]).toMatchObject({ id: 'n-vex', name: 'Warlord Vex' })
  })

  test('Save changes is on the first step too', async () => {
    await renderRedesign()
    await act(async () => {
      fireEvent.change(screen.getByLabelText(/Hit Points/), { target: { value: '9' } })
    })
    await click('Save changes')
    await waitFor(() => expect(saved).toEqual(['n-vex']))
    expect(useUnits.getState().npcs[0]?.hitPoints).toBe(9)
  })
})
