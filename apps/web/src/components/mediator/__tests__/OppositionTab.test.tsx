/**
 * The Opposition tab (mediator-dashboard.md Q9) on its own: the tray's
 * loading and empty states, a row that no longer resolves, a down NPC and its
 * last Morale roll, the reference card a row opens, the picker that adds from
 * any of the tray schemas (a mech as one of its patterns), Remove behind its
 * confirmation, and every refused write handed to `onFailure`.
 *
 * Presentational: the tab takes the tray and its writes as props, so this
 * records what it asks for.
 */

import { beforeEach, describe, expect, test } from 'bun:test'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import type { RefEntity, RefObjectAnyPattern } from 'salvageunion-reference'
import type { TrayWrites } from '../OppositionTab'
import { OppositionTab } from '../OppositionTab'
import type { EncounterRefSchema, TrayNpc } from '../opposition.model'
import { readTrayNpc } from '../opposition.model'

type Call = { name: keyof TrayWrites; args: unknown[] }

const calls: Call[] = []
const failures: unknown[] = []

function trayWrites(refuse: ReadonlySet<keyof TrayWrites> = new Set()): TrayWrites {
  const record =
    (name: keyof TrayWrites) =>
    async (...args: unknown[]) => {
      calls.push({ name, args })
      if (refuse.has(name)) throw new Error(`${name} refused`)
    }
  return {
    add: record('add'),
    setHp: record('setHp'),
    morale: record('morale'),
    remove: record('remove'),
  }
}

const ROLLED_AT = '2026-10-09T12:00:00.000Z'

const rifleSquad = readTrayNpc({
  _id: 'n1',
  body: {
    name: 'Rifle Squad',
    refSchema: 'squads',
    refSlug: 'rifle-squad',
    currentHp: 7,
    maxHp: 10,
    statKind: 'hp',
  },
})

const fallenRaider = readTrayNpc({
  _id: 'n2',
  body: {
    name: 'Raider 2',
    refSchema: 'npcs',
    refSlug: 'raider',
    currentHp: 0,
    maxHp: 4,
    lastMediatorRoll: {
      table: 'Morale',
      roll: 3,
      label: 'Flee',
      value: 'They break and run.',
      rolledAt: ROLLED_AT,
    },
  },
})

/** An older row: a name, no reference, nothing to track. */
const oldRow = readTrayNpc({ _id: 'n3', body: { name: 'Old Hermit' } })

async function renderTab(
  npcs: readonly TrayNpc[] | null,
  { canWrite = true, writes = trayWrites() }: { canWrite?: boolean; writes?: TrayWrites } = {}
) {
  await act(async () => {
    render(
      <OppositionTab
        npcs={npcs}
        canWrite={canWrite}
        writes={writes}
        onFailure={(err) => failures.push(err)}
      />
    )
  })
}

async function click(el: HTMLElement) {
  await act(async () => {
    fireEvent.click(el)
  })
}

beforeEach(() => {
  calls.length = 0
  failures.length = 0
})

describe('the tray', () => {
  test('while it loads, it says so, and counts nobody on the field', async () => {
    await renderTab(null)
    expect(screen.getByText('The tray is on its way.')).toBeTruthy()
    expect(screen.getByText('Hidden from players · 0 on the field')).toBeTruthy()
  })

  test('empty, it says how to fill it', async () => {
    await renderTab([])
    expect(screen.getByText(/No opposition yet\./)).toBeTruthy()
    expect(screen.queryByRole('list', { name: 'Opposition' })).toBeNull()
  })

  test('a down NPC is not on the field, reads Down, and keeps its last Morale roll', async () => {
    await renderTab([rifleSquad, fallenRaider])
    expect(screen.getByText('Hidden from players · 1 on the field')).toBeTruthy()
    const rows = within(screen.getByRole('list', { name: 'Opposition' })).getAllByRole('listitem')
    const raider = rows[1]
    if (!raider) throw new Error('no Raider row')
    expect(within(raider).getByRole('status').textContent).toBe(
      'Down. Morale 3 · Flee — They break and run.'
    )
    // Rifle Squad has neither.
    expect(within(rows[0] as HTMLElement).getByRole('status').textContent).toBe('')
  })

  test('a row whose reference no longer resolves shows its name plainly, with no gauge', async () => {
    await renderTab([oldRow])
    expect(screen.getByText('Old Hermit')).toBeTruthy()
    expect(screen.queryByLabelText('Old Hermit: the full reference card')).toBeNull()
    expect(screen.queryByRole('group', { name: 'Old Hermit HP' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Roll Morale for Old Hermit' })).toBeTruthy()
  })

  test('an NPC tracking SP names its gauge SP', async () => {
    const drone = { ...rifleSquad, id: 'n4', name: 'Sentry', statKind: 'sp' as const }
    await renderTab([drone])
    const group = screen.getByRole('group', { name: 'Sentry SP' })
    expect(within(group).getByRole('slider', { name: 'SP' })).toBeTruthy()
  })

  test("a row opens the NPC's full reference card", async () => {
    await renderTab([rifleSquad])
    await click(screen.getByLabelText('Rifle Squad: the full reference card'))
    expect(within(screen.getByRole('dialog')).getAllByText(/Rifle Squad/).length).toBeGreaterThan(0)
  })
})

describe('writes', () => {
  test('the gauge sets HP and Morale rolls, each with the NPC', async () => {
    await renderTab([rifleSquad])
    const hp = screen.getByRole('slider', { name: 'HP' })
    await act(async () => {
      fireEvent.keyDown(hp, { key: 'ArrowRight' })
    })
    await click(screen.getByRole('button', { name: 'Roll Morale for Rifle Squad' }))
    expect(calls).toEqual([
      { name: 'setHp', args: [rifleSquad, 8] },
      { name: 'morale', args: [rifleSquad] },
    ])
    expect(failures).toEqual([])
  })

  test('a refused HP change or Morale roll goes to onFailure', async () => {
    await renderTab([rifleSquad], { writes: trayWrites(new Set(['setHp', 'morale'])) })
    await act(async () => {
      fireEvent.keyDown(screen.getByRole('slider', { name: 'HP' }), { key: 'ArrowLeft' })
    })
    await click(screen.getByRole('button', { name: 'Roll Morale for Rifle Squad' }))
    expect(failures.map((e) => (e as Error).message)).toEqual(['setHp refused', 'morale refused'])
  })

  test('Remove asks first; Cancel removes nothing', async () => {
    await renderTab([rifleSquad])
    await click(screen.getByRole('button', { name: 'Remove Rifle Squad' }))
    const dialog = within(screen.getByRole('alertdialog', { name: 'Remove Rifle Squad?' }))
    await click(dialog.getByRole('button', { name: 'Cancel' }))
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
    expect(calls).toEqual([])
  })

  test('Remove, confirmed, removes that NPC', async () => {
    await renderTab([rifleSquad, fallenRaider])
    await click(screen.getByRole('button', { name: 'Remove Raider 2' }))
    await click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Remove' }))
    expect(calls).toEqual([{ name: 'remove', args: [fallenRaider] }])
  })

  test('offline, nothing writes: add, Morale and Remove are disabled and the gauge reads out', async () => {
    await renderTab([rifleSquad], { canWrite: false })
    for (const name of [
      '+ From the reference',
      'Roll Morale for Rifle Squad',
      'Remove Rifle Squad',
    ]) {
      expect((screen.getByRole('button', { name }) as HTMLButtonElement).disabled).toBe(true)
    }
    expect(screen.queryByRole('slider')).toBeNull()
  })
})

describe('+ From the reference', () => {
  async function openPicker() {
    await click(screen.getByRole('button', { name: '+ From the reference' }))
    return within(screen.getByRole('dialog'))
  }

  test('opens on NPCs, adds the one picked, and counts what the tray already holds', async () => {
    await renderTab([fallenRaider])
    const picker = await openPicker()
    expect((picker.getByLabelText('Draw from') as HTMLSelectElement).value).toBe('npcs')
    // The Raider already on the field is counted on its card.
    expect(picker.getByText('1 Added')).toBeTruthy()

    await click(picker.getByRole('button', { name: 'Add Trooper' }))
    expect(calls).toHaveLength(1)
    const [schema, entity] = (calls[0]?.args ?? []) as [EncounterRefSchema, RefEntity]
    expect(calls[0]?.name).toBe('add')
    expect(schema).toBe('npcs')
    expect(entity.name).toBe('Trooper')
  })

  test('Draw from switches the schema it searches', async () => {
    await renderTab([])
    const picker = await openPicker()
    await act(async () => {
      fireEvent.change(picker.getByLabelText('Draw from'), { target: { value: 'creatures' } })
    })
    expect(picker.queryByRole('button', { name: 'Add Trooper' })).toBeNull()
    await click(picker.getByRole('button', { name: 'Add Wasteland Bear' }))
    const [schema, entity] = (calls[0]?.args ?? []) as [EncounterRefSchema, RefEntity]
    expect(schema).toBe('creatures')
    expect(entity.name).toBe('Wasteland Bear')
  })

  // The Mechs pool is every chassis card at full size: switching to it alone
  // renders for ~2.3s (measured), so one test walks every pattern path and
  // carries a longer timeout.
  test('Mechs asks which pattern before adding; Cancel adds nothing, No pattern the bare chassis', async () => {
    await renderTab([])
    const picker = await openPicker()
    await act(async () => {
      fireEvent.change(picker.getByLabelText('Draw from'), { target: { value: 'chassis' } })
    })
    await act(async () => {
      fireEvent.change(picker.getByLabelText('Search'), { target: { value: 'Mule' } })
    })
    const addMule = () => click(picker.getByRole('button', { name: 'Add Mule' }))
    const choose = async (value: string) => {
      await act(async () => {
        fireEvent.change(picker.getByLabelText('Mule pattern'), { target: { value } })
      })
    }

    await addMule()
    // Nothing is added until the pattern is chosen; the first is preselected.
    expect(calls).toHaveLength(0)
    expect((picker.getByLabelText('Mule pattern') as HTMLSelectElement).value).toBe('hauler')
    await click(picker.getByRole('button', { name: 'Cancel' }))
    expect(picker.queryByLabelText('Mule pattern')).toBeNull()
    expect(calls).toHaveLength(0)

    await addMule()
    await choose('crusher')
    await click(picker.getByRole('button', { name: 'Add to the field' }))
    const [schema, entity, drawn] = (calls[0]?.args ?? []) as [
      EncounterRefSchema,
      RefEntity,
      RefObjectAnyPattern | undefined,
    ]
    expect(schema).toBe('chassis')
    expect(entity.name).toBe('Mule')
    expect(drawn?.name).toBe('Crusher')
    expect(picker.queryByLabelText('Mule pattern')).toBeNull()

    await addMule()
    await choose('')
    await click(picker.getByRole('button', { name: 'Add to the field' }))
    expect(calls[1]?.args[2]).toBeUndefined()
  }, 20_000)

  test('a refused add goes to onFailure', async () => {
    await renderTab([], { writes: trayWrites(new Set(['add'])) })
    const picker = await openPicker()
    await click(picker.getByRole('button', { name: 'Add Raider' }))
    expect(failures.map((e) => (e as Error).message)).toEqual(['add refused'])
  })

  test('closing the picker puts it away', async () => {
    await renderTab([])
    const picker = await openPicker()
    await click(picker.getByRole('button', { name: 'Close' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  })
})
