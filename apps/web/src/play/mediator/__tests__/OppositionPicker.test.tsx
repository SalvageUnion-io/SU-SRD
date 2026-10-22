/**
 * The Opposition's picker and its two questions on their own (play.md §10):
 * the picker that adds from any of the Opposition's schemas (a mech as one of
 * its patterns), Rename, Delete behind its confirmation, and a refused add
 * handed to the caller.
 *
 * Presentational: they take the NPCs and the writes as props, so this records
 * what they ask for. The harness opens them as `PlayMediatorOpposition` does.
 */

import { beforeEach, describe, expect, test } from 'bun:test'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { useState } from 'react'
import type { RefEntity } from 'salvageunion-reference'
import { SheetPickerModal } from '../../../build/sheet/SheetPickerModal'
import { pickInSearcher, searcherMini } from '../../../components/__tests__/searcherPick'
import type { TrayWrites } from '../OppositionPicker'
import { OppositionDialogs, OppositionPicker } from '../OppositionPicker'
import type { EncounterRefSchema, SavedPattern, TrayDraw, TrayNpc } from '../opposition.model'
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
    rename: record('rename'),
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

/** The picker and the questions, opened as the Mediator's screen opens them. */
function Harness({
  npcs,
  writes,
  savedPatterns,
}: {
  npcs: readonly TrayNpc[]
  writes: TrayWrites
  savedPatterns: readonly SavedPattern[]
}) {
  const [picking, setPicking] = useState(false)
  const [removing, setRemoving] = useState<TrayNpc | null>(null)
  const [renaming, setRenaming] = useState<TrayNpc | null>(null)
  return (
    <>
      <button type="button" onClick={() => setPicking(true)}>
        + Add
      </button>
      {npcs.map((npc) => (
        <div key={npc.id}>
          <button type="button" onClick={() => setRenaming(npc)}>
            Rename {npc.name}
          </button>
          <button type="button" onClick={() => setRemoving(npc)}>
            Delete {npc.name}
          </button>
        </div>
      ))}
      <SheetPickerModal
        open={picking}
        onClose={() => setPicking(false)}
        title="Add opposition from the reference"
        floating
      >
        <OppositionPicker
          npcs={npcs}
          saved={savedPatterns}
          onAdd={(schema, entity, draw) =>
            void writes.add(schema, entity, draw).catch((err) => failures.push(err))
          }
        />
      </SheetPickerModal>
      <OppositionDialogs
        removing={removing}
        renaming={renaming}
        onClose={() => {
          setRemoving(null)
          setRenaming(null)
        }}
        writes={writes}
      />
    </>
  )
}

async function renderTab(
  npcs: readonly TrayNpc[],
  {
    writes = trayWrites(),
    savedPatterns = [],
  }: { writes?: TrayWrites; savedPatterns?: readonly SavedPattern[] } = {}
) {
  await act(async () => {
    render(<Harness npcs={npcs} writes={writes} savedPatterns={savedPatterns} />)
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

describe('Delete and Rename', () => {
  test('Delete asks first; Cancel deletes nothing', async () => {
    await renderTab([rifleSquad])
    await click(screen.getByRole('button', { name: 'Delete Rifle Squad' }))
    const dialog = within(screen.getByRole('alertdialog', { name: 'Delete Rifle Squad?' }))
    await click(dialog.getByRole('button', { name: 'Cancel' }))
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
    expect(calls).toEqual([])
  })

  test('Delete, confirmed, deletes that NPC', async () => {
    await renderTab([rifleSquad, fallenRaider])
    await click(screen.getByRole('button', { name: 'Delete Raider 2' }))
    await click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Delete' }))
    expect(calls).toEqual([{ name: 'remove', args: [fallenRaider] }])
  })

  test('Rename starts from the current name and saves the new one, trimmed', async () => {
    await renderTab([rifleSquad])
    await click(screen.getByRole('button', { name: 'Rename Rifle Squad' }))
    const dialog = within(screen.getByRole('alertdialog', { name: 'Rename Rifle Squad' }))
    const field = dialog.getByLabelText('Name') as HTMLInputElement
    expect(field.value).toBe('Rifle Squad')
    await act(async () => {
      fireEvent.change(field, { target: { value: '  Red Leader ' } })
    })
    await click(dialog.getByRole('button', { name: 'Rename' }))
    expect(calls).toEqual([{ name: 'rename', args: [rifleSquad, 'Red Leader'] }])
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
  })

  test('Rename refuses a blank name and stays open', async () => {
    await renderTab([rifleSquad])
    await click(screen.getByRole('button', { name: 'Rename Rifle Squad' }))
    const dialog = within(screen.getByRole('alertdialog'))
    await act(async () => {
      fireEvent.change(dialog.getByLabelText('Name'), { target: { value: '   ' } })
    })
    await click(dialog.getByRole('button', { name: 'Rename' }))
    expect(calls).toEqual([])
    expect(dialog.getByText('A name cannot be blank.')).toBeTruthy()
  })
})

describe('+ From the reference', () => {
  async function openPicker() {
    await click(screen.getByRole('button', { name: '+ Add' }))
    return within(dialog())
  }
  const dialog = () => screen.getByRole('dialog')
  /** Open the entity's Page in the picker and press its Add. */
  async function add(name: string) {
    await pickInSearcher(name, dialog())
  }

  test('opens on NPCs, adds the one picked, and counts what is already on the field', async () => {
    await renderTab([fallenRaider])
    const picker = await openPicker()
    expect((picker.getByLabelText('Draw from') as HTMLSelectElement).value).toBe('npcs')
    // The Raider already on the field is marked chosen in the list.
    const raider = searcherMini('Raider', dialog())?.closest('.su-searcher__item')
    expect(raider?.hasAttribute('data-selected')).toBe(true)

    await add('Trooper')
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
    expect(searcherMini('Trooper', dialog())).toBeNull()
    await add('Wasteland Bear')
    const [schema, entity] = (calls[0]?.args ?? []) as [EncounterRefSchema, RefEntity]
    expect(schema).toBe('creatures')
    expect(entity.name).toBe('Wasteland Bear')
  })

  test('a name typed under Draw from goes with the next add, then clears', async () => {
    await renderTab([])
    const picker = await openPicker()
    const name = picker.getByLabelText('Name (optional)') as HTMLInputElement
    await act(async () => {
      fireEvent.change(name, { target: { value: 'Red Leader' } })
    })
    await add('Trooper')
    expect(calls[0]?.args[2]).toEqual({ name: 'Red Leader' })
    expect(name.value).toBe('')
    // Left blank, the reference name stands.
    await add('Trooper')
    expect(calls[1]?.args[2]).toEqual({})
  })

  // The Mechs pool is every chassis card at full size: switching to it alone
  // renders for ~2.3s (measured), so one test walks every pattern path and
  // carries a longer timeout.
  test('Mechs asks which pattern before adding, saved ones too; Cancel adds nothing, No pattern the bare chassis', async () => {
    const redLeader: SavedPattern = {
      id: 'p1',
      name: 'Red Leader',
      chassisRef: 'mule',
      systems: [],
      modules: [],
      madeBy: 'Player',
    }
    const onAnother: SavedPattern = {
      ...redLeader,
      id: 'p2',
      name: 'Elsewhere',
      chassisRef: 'brawler',
    }
    await renderTab([], { savedPatterns: [redLeader, onAnother] })
    const picker = await openPicker()
    await act(async () => {
      fireEvent.change(picker.getByLabelText('Draw from'), { target: { value: 'chassis' } })
    })
    await act(async () => {
      fireEvent.change(picker.getByLabelText('Search'), { target: { value: 'Mule' } })
    })
    const addMule = () => add('Mule')
    const choose = async (value: string) => {
      await act(async () => {
        fireEvent.change(picker.getByLabelText('Mule pattern'), { target: { value } })
      })
    }

    await addMule()
    // Nothing is added until the pattern is chosen; the first is preselected.
    expect(calls).toHaveLength(0)
    expect((picker.getByLabelText('Mule pattern') as HTMLSelectElement).value).toBe('book:hauler')
    await click(picker.getByRole('button', { name: 'Cancel' }))
    expect(picker.queryByLabelText('Mule pattern')).toBeNull()
    expect(calls).toHaveLength(0)

    await addMule()
    // Saved patterns built on this chassis are offered by maker; others are not.
    const options = [...(picker.getByLabelText('Mule pattern') as HTMLSelectElement).options]
    expect(options.map((o) => o.text)).toContain('Red Leader · Player')
    expect(options.map((o) => o.text)).not.toContain('Elsewhere · Player')
    await choose('book:crusher')
    await click(picker.getByRole('button', { name: 'Add to the field' }))
    const [schema, entity, draw] = (calls[0]?.args ?? []) as [
      EncounterRefSchema,
      RefEntity,
      TrayDraw,
    ]
    expect(schema).toBe('chassis')
    expect(entity.name).toBe('Mule')
    expect(draw.pattern?.name).toBe('Crusher')
    expect(picker.queryByLabelText('Mule pattern')).toBeNull()

    await addMule()
    await choose('saved:p1')
    await click(picker.getByRole('button', { name: 'Add to the field' }))
    expect(calls[1]?.args[2]).toEqual({ saved: redLeader })

    await addMule()
    await choose('')
    await click(picker.getByRole('button', { name: 'Add to the field' }))
    expect(calls[2]?.args[2]).toEqual({})
  }, 20_000)

  test('a refused add goes to onFailure', async () => {
    await renderTab([], { writes: trayWrites(new Set(['add'])) })
    await openPicker()
    await add('Raider')
    expect(failures.map((e) => (e as Error).message)).toEqual(['add refused'])
  })

  test('closing the picker puts it away', async () => {
    await renderTab([])
    const picker = await openPicker()
    await click(picker.getByRole('button', { name: 'Close' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  })
})
