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
import type { Npc } from 'game-domain/schemas/npc'
import { useState } from 'react'
import type { RefEntity } from 'salvageunion-reference'
import { SheetPickerModal } from '../../../build/sheet/SheetPickerModal'
import {
  openInSearcher,
  pickInSearcher,
  searcherMini,
} from '../../../components/__tests__/searcherPick'
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
    addBuilt: record('addBuilt'),
    setHp: record('setHp'),
    salvageRoll: record('salvageRoll'),
    morale: record('morale'),
    groupRoll: record('groupRoll'),
    setImportant: record('setImportant'),
    setReactor: record('setReactor'),
    critical: record('critical'),
    heatCheck: record('heatCheck'),
    remove: record('remove'),
    clear: record('clear'),
    clearDowned: async () => {
      await record('clearDowned')()
      return { removed: 0, undo: async () => undefined }
    },
    rename: record('rename'),
    field: async (...args: unknown[]) => {
      await record('field')(...args)
      return 0
    },
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
          yours={[KESSLER]}
          onAddBuilt={(npc, name) => void writes.addBuilt(npc, name)}
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

/** One of the Mediator's own designed NPCs. */
const KESSLER: Npc = {
  id: 'npc-1',
  schemaVersion: 1,
  name: 'Sergeant Kessler',
  hitPoints: 9,
  damageType: 'HP',
  actions: ['rifle'],
  traits: [],
  createdAt: ROLLED_AT,
  updatedAt: ROLLED_AT,
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
    expect(picker.getByRole('button', { name: 'NPCs' }).getAttribute('aria-pressed')).toBe('true')
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

  test('a search that finds nothing in this kind moves to the first kind that finds it (r6 E8)', async () => {
    await renderTab([])
    const picker = await openPicker()
    const search = screen.getByRole('textbox', { name: 'Search' })
    await act(async () => {
      fireEvent.change(search, { target: { value: 'mule' } })
    })
    // No NPC is a Mule; two Mechs are (LG6-22).
    expect(picker.getByRole('button', { name: 'Mechs 2' }).getAttribute('aria-pressed')).toBe(
      'true'
    )
  })

  test('the kinds sit above the search; a kind switches what it searches', async () => {
    await renderTab([])
    const picker = await openPicker()
    await click(picker.getByRole('button', { name: 'Creatures' }))
    expect(searcherMini('Trooper', dialog())).toBeNull()
    await add('Wasteland Bear')
    const [schema, entity] = (calls[0]?.args ?? []) as [EncounterRefSchema, RefEntity]
    expect(schema).toBe('creatures')
    expect(entity.name).toBe('Wasteland Bear')
  })

  test('one search carries across the kinds, each saying how many it finds (MD-05)', async () => {
    await renderTab([])
    const picker = await openPicker()
    await act(async () => {
      fireEvent.change(picker.getByLabelText('Search'), { target: { value: 'Wasteland Bear' } })
    })
    expect(picker.getByRole('button', { name: /^Creatures [1-9]/ })).toBeTruthy()
    await click(picker.getByRole('button', { name: /^Creatures/ }))
    // The search is still there on the kind it moved to.
    expect((picker.getByLabelText('Search') as HTMLInputElement).value).toBe('Wasteland Bear')
    expect(searcherMini('Wasteland Bear', dialog())).not.toBeNull()
  })

  test('On the field names each unit as it fights, not by its book name (r5 B11)', async () => {
    await renderTab([{ ...fallenRaider, name: 'Lookout' }])
    await openPicker()
    const rail = within(dialog()).getAllByTestId('rail-entry')
    expect(rail[0]?.textContent).toContain('Lookout')
  })

  test('On the field counts every kind, not only the one showing (MD-22)', async () => {
    await renderTab([rifleSquad, fallenRaider])
    await openPicker()
    expect(within(dialog()).getAllByTestId('rail-entry')).toHaveLength(2)
  })

  test("Yours offers the Mediator's own designed NPCs (MD-07)", async () => {
    await renderTab([])
    const picker = await openPicker()
    await click(picker.getByRole('button', { name: 'Yours' }))
    await add('Sergeant Kessler')
    expect(calls).toEqual([{ name: 'addBuilt', args: [KESSLER, ''] }])
  })

  test('a name typed beside Add goes with that add, then clears (r5 B11)', async () => {
    await renderTab([])
    await openPicker()
    const bar = await openInSearcher('Trooper', dialog())
    const name = within(bar).getByLabelText('Name (optional)') as HTMLInputElement
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

  test('a mech is added in one step, its pattern chosen beside Add, saved ones too (MD-06)', async () => {
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
    await click(picker.getByRole('button', { name: 'Mechs' }))
    await act(async () => {
      fireEvent.change(picker.getByLabelText('Search'), { target: { value: 'Mule' } })
    })
    const choose = async (value: string) => {
      await act(async () => {
        fireEvent.change(picker.getByLabelText('Mule pattern'), { target: { value } })
      })
    }

    // One press adds it as the pattern showing: the first is preselected.
    await add('Mule')
    expect(calls).toHaveLength(1)
    expect((calls[0]?.args[2] as TrayDraw | undefined)?.pattern?.name).toBe('Hauler')

    // Saved patterns built on this chassis are offered by maker; others are not.
    const options = [...(picker.getByLabelText('Mule pattern') as HTMLSelectElement).options]
    expect(options.map((o) => o.text)).toContain('Mule · Red Leader · Player')
    expect(options.map((o) => o.text)).not.toContain('Elsewhere · Player')
    await choose('book:crusher')
    await add('Mule')
    const [schema, entity, draw] = (calls[1]?.args ?? []) as [
      EncounterRefSchema,
      RefEntity,
      TrayDraw,
    ]
    expect(schema).toBe('chassis')
    expect(entity.name).toBe('Mule')
    expect(draw.pattern?.name).toBe('Crusher')

    await choose('saved:p1')
    await add('Mule')
    expect(calls[2]?.args[2]).toEqual({ saved: redLeader })

    await choose('')
    await add('Mule')
    expect(calls[3]?.args[2]).toEqual({})
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

describe('the preview says what a denizen can do (r4 D4)', () => {
  test('an NPC’s Page lists its weapon, as its Reference page does', async () => {
    await renderTab([])
    await click(screen.getByRole('button', { name: '+ Add' }))
    await openInSearcher('Raider')
    const page = within(screen.getByRole('article', { name: 'Raider' }))
    expect(page.getAllByText('Improvised Firearm').length).toBeGreaterThan(0)
  })

  test('a Squad’s Page lists its weapon too', async () => {
    await renderTab([])
    await click(screen.getByRole('button', { name: '+ Add' }))
    await click(screen.getByRole('button', { name: 'Squads' }))
    await openInSearcher('Rifle Squad')
    const page = within(screen.getByRole('article', { name: 'Rifle Squad' }))
    expect(page.getAllByText(/Rifle/).length).toBeGreaterThan(1)
  })
})
