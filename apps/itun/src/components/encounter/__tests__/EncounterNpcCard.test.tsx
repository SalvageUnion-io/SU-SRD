/**
 * EncounterNpcCard — encounter tray instance card tests (design-review R-5).
 *
 * Runs against the REAL encounterStore backed by fake-indexeddb (preloaded
 * via bunfig.toml), with the d20 and roll-table lookup injected so Mediator
 * rolls are deterministic and need no preloaded reference data.
 */

import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { _clearAllStores, _resetDbSingleton } from '../../../lib/db/index'
import type { FindRollTable } from '../../../lib/rules/mediatorTables'
import type { EncounterNpc } from '../../../lib/schemas/encounterNpc'
import { useEncounterStore } from '../../../stores/encounterStore'
import { FIXTURE_NOW } from '../../__tests__/fixtures'
import { must } from '../../__tests__/must'
import { EncounterNpcCard } from '../EncounterNpcCard'

const FAKE_TABLES: Record<string, { table: Record<string, unknown> }> = {
  Morale: {
    table: {
      '1': { label: 'Surrender', value: 'The NPCs surrender.' },
      '2-5': { label: 'Retreat', value: 'The NPCs flee.' },
      '6-10': { label: 'Fighting Retreat', value: 'One more round, then retreat.' },
      '11-19': { label: 'Keep Fighting', value: 'They continue to fight.' },
      '20': { label: 'Fight to the Death', value: 'They never retreat.' },
      type: 'standard',
    },
  },
}

const findTable: FindRollTable = (name) => FAKE_TABLES[name]

function resetStore(): void {
  useEncounterStore.setState({ encounterNpcs: [], hydrated: false })
}

beforeEach(async () => {
  _resetDbSingleton()
  await _clearAllStores()
  resetStore()
})

afterEach(async () => {
  cleanup()
  await _clearAllStores()
  resetStore()
})

async function seedNpc(overrides: Partial<EncounterNpc> = {}): Promise<EncounterNpc> {
  let npc: EncounterNpc | undefined
  await act(async () => {
    npc = await useEncounterStore.getState().create({
      schemaVersion: 1,
      refSchema: 'npcs',
      refSlug: 'raider',
      refName: 'Raider',
      name: 'Raider',
      currentHp: 3,
      maxHp: 3,
      statKind: 'hp',
      conditions: [],
      ...overrides,
    })
  })
  return must(npc)
}

describe('EncounterNpcCard — rendering', () => {
  test('shows the schema tag, instance name, and HP track', async () => {
    const npc = await seedNpc()
    render(<EncounterNpcCard npc={npc} store={useEncounterStore} findTable={findTable} />)

    expect(screen.getByText('NPC')).toBeTruthy()
    expect(screen.getByText('Raider')).toBeTruthy()
    expect(screen.getByText('HP')).toBeTruthy()
  })

  test('shows persisted condition ticks', async () => {
    const npc = await seedNpc({ conditions: ['On Fire', 'Pinned'] })
    render(<EncounterNpcCard npc={npc} store={useEncounterStore} findTable={findTable} />)

    expect(screen.getByText('On Fire')).toBeTruthy()
    expect(screen.getByText('Pinned')).toBeTruthy()
  })
})

describe('EncounterNpcCard — conditions', () => {
  test('adding a condition persists it to the store', async () => {
    const npc = await seedNpc()
    render(<EncounterNpcCard npc={npc} store={useEncounterStore} findTable={findTable} />)

    fireEvent.change(screen.getByLabelText('Add condition to Raider'), {
      target: { value: 'Suppressed' },
    })
    fireEvent.click(screen.getByLabelText('Confirm new condition for Raider'))

    await waitFor(() => {
      expect(useEncounterStore.getState().get(npc.id)?.conditions).toEqual(['Suppressed'])
    })
  })

  test('clearing a condition removes it from the store', async () => {
    const npc = await seedNpc({ conditions: ['On Fire'] })
    render(<EncounterNpcCard npc={npc} store={useEncounterStore} findTable={findTable} />)

    fireEvent.click(screen.getByLabelText('Clear On Fire on Raider'))

    await waitFor(() => {
      expect(useEncounterStore.getState().get(npc.id)?.conditions).toEqual([])
    })
  })
})

describe('EncounterNpcCard — Mediator rolls', () => {
  test('a Morale roll persists the result on the instance and shows the readout', async () => {
    const npc = await seedNpc()
    render(
      <EncounterNpcCard npc={npc} store={useEncounterStore} roll={() => 4} findTable={findTable} />
    )

    fireEvent.click(screen.getByLabelText('Roll Morale for Raider'))

    await waitFor(() => {
      const saved = useEncounterStore.getState().get(npc.id)?.lastMediatorRoll
      expect(saved?.table).toBe('morale')
      expect(saved?.roll).toBe(4)
      expect(saved?.label).toBe('Retreat')
    })
  })

  test('renders the persisted last roll readout', async () => {
    const npc = await seedNpc({
      lastMediatorRoll: {
        table: 'morale',
        roll: 20,
        label: 'Fight to the Death',
        value: 'They never retreat.',
        rolledAt: FIXTURE_NOW,
      },
    })
    render(<EncounterNpcCard npc={npc} store={useEncounterStore} findTable={findTable} />)

    expect(screen.getByRole('status').textContent).toContain(
      'Morale: rolled 20 — Fight to the Death. They never retreat.'
    )
  })
})

describe('EncounterNpcCard — remove', () => {
  test('Remove asks for confirmation, then deletes the instance', async () => {
    const npc = await seedNpc()
    render(<EncounterNpcCard npc={npc} store={useEncounterStore} findTable={findTable} />)

    fireEvent.click(screen.getByLabelText('Remove Raider from the tray'))
    // ModalShell renders the title in both the header and the a11y title slot.
    expect(screen.getAllByText('Remove Raider?').length).toBeGreaterThan(0)

    fireEvent.click(screen.getByRole('button', { name: 'Remove' }))

    await waitFor(() => {
      expect(useEncounterStore.getState().get(npc.id)).toBeNull()
    })
  })
})
