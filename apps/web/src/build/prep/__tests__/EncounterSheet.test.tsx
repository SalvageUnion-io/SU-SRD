/**
 * An encounter's groups, waves and briefing on its page (ADR-059 §5), the
 * surface behind the `encounterSheet` flag. A unit test builds for production,
 * where every flag is off, so `flags` is replaced here with the real module
 * and that flag on. `mock.module` is process-global (see
 * `.claude/rules/testing-patterns.md`), hence the capture-before-mock and the
 * `afterAll` restore.
 */

import { afterAll, beforeEach, describe, expect, mock, test } from 'bun:test'
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import type { Encounter } from 'game-domain/schemas/encounter'
import { installServerMocks } from '../../../components/__tests__/serverMock'
import { withSignedInBackend } from '../../../replica/__tests__/signedInBackend'
import type { SyncState } from '../../../replica/syncContext'

// Module scope, before the imports below — see `serverMock.ts`.
const serverMocks = await installServerMocks()

// Capture before mocking: a module namespace is a live view.
const realFlags = { ...(await import('../../../lib/flags')) }
mock.module('../../../lib/flags', () => ({ ...realFlags, flagOn: () => true }))

afterAll(async () => {
  mock.module('../../../lib/flags', () => realFlags)
  serverMocks.restore()
  const { flagOn } = await import('../../../lib/flags')
  if (flagOn('encounterSheet')) throw new Error('flags were not restored')
})

const { ToasterMount, toast } = await import('../../../components/index')
const { SyncContext } = await import('../../../replica/syncContext')
const { resetStores } = await import('../../../replica/__tests__/resetStores')
const { useEncounters, usePatterns } = await import('../../../replica/collections')
const { EncounterPage } = await import('../EncounterPage')
const { useSheetModeStore } = await import('../../sheet/sheetMode.model')

withSignedInBackend()

const NOW = '2026-10-24T00:00:00.000Z'

const raider = (id: string, name: string, groupId?: string) => ({
  id,
  refSchema: 'npcs' as const,
  refSlug: 'raider',
  refName: 'Raider',
  name,
  maxHp: 3,
  statKind: 'hp' as const,
  ...(groupId === undefined ? {} : { groupId }),
})

const AMBUSH: Encounter = {
  id: 'enc-1',
  schemaVersion: 1,
  name: 'Ambush',
  opposition: [raider('o1', 'Raider', 'band'), raider('o2', 'Lookout'), raider('o3', 'Sniper')],
  groups: [{ id: 'band', name: 'Raider Band', wave: 1 }],
  tables: [],
  notes: '',
  createdAt: NOW,
  updatedAt: NOW,
}

const connection: SyncState = { status: 'live', canWrite: true, outdated: false }

beforeEach(() => {
  useSheetModeStore.setState({ editing: true })
  toast.dismiss()
  resetStores()
  useEncounters.setState({ encounters: [AMBUSH], hydrated: true } as never)
  usePatterns.setState({ mechPatterns: [], hydrated: true })
})

async function settle(done: () => boolean = () => false): Promise<void> {
  for (let i = 0; i < 40 && !done(); i++) {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 5))
    })
  }
}

const current = () => useEncounters.getState().get('enc-1')

async function renderPage() {
  await act(async () => {
    render(
      <SyncContext.Provider value={connection}>
        <ToasterMount />
        <EncounterPage id="enc-1" />
      </SyncContext.Provider>
    )
  })
}

async function click(el: HTMLElement) {
  await act(async () => {
    fireEvent.click(el)
  })
}

async function choose(menuFor: string, item: string) {
  await click(screen.getByRole('button', { name: `More for ${menuFor}` }))
  await click(within(screen.getByRole('menu')).getByRole('menuitem', { name: item }))
}

describe("an encounter's groups", () => {
  test('lists those alone, then each group with its wave', async () => {
    await renderPage()
    expect(
      within(screen.getByRole('list', { name: 'Fighting alone' })).getByText('Lookout')
    ).toBeTruthy()
    expect(
      within(screen.getByRole('list', { name: 'Raider Band' })).getByText('Raider')
    ).toBeTruthy()
    expect(screen.getByText('Wave 1')).toBeTruthy()
  })

  test('+ Group names a new group, and refuses a blank name', async () => {
    await renderPage()
    await click(screen.getByRole('button', { name: 'Add a group' }))
    const dialog = screen.getByRole('alertdialog', { name: 'Add a group' })
    await click(within(dialog).getByRole('button', { name: 'Add group' }))
    expect(within(dialog).getByText('A group needs a name.')).toBeTruthy()
    await act(async () => {
      fireEvent.change(within(dialog).getByRole('textbox'), {
        target: { value: '  Gantry snipers ' },
      })
    })
    await click(within(dialog).getByRole('button', { name: 'Add group' }))
    await settle(() => current()?.groups?.length === 2)
    expect(current()?.groups?.[1]).toMatchObject({ name: 'Gantry snipers', wave: 1 })
  })

  test('an opponent moves into a group and back out from its ⋯ menu', async () => {
    await renderPage()
    await choose('Sniper', 'Move to Raider Band')
    await settle(() => current()?.opposition[2]?.groupId === 'band')
    expect(current()?.opposition[2]?.groupId).toBe('band')
    await choose('Raider', 'Fight alone')
    await settle(() => current()?.opposition[0]?.groupId === undefined)
    expect(current()?.opposition[0]).not.toHaveProperty('groupId')
  })

  test('a group is held back to a later wave, renamed and removed', async () => {
    await renderPage()
    await choose('Raider Band', 'Hold back to wave 2')
    await settle(() => current()?.groups?.[0]?.wave === 2)
    expect(screen.getByText('Wave 2 · held back')).toBeTruthy()

    await choose('Raider Band', 'Rename…')
    const dialog = screen.getByRole('alertdialog', { name: 'Rename Raider Band' })
    await act(async () => {
      fireEvent.change(within(dialog).getByRole('textbox'), { target: { value: 'Crusher crew' } })
    })
    await click(within(dialog).getByRole('button', { name: 'Rename' }))
    await settle(() => current()?.groups?.[0]?.name === 'Crusher crew')

    await choose('Crusher crew', 'Remove group')
    await settle(() => current()?.groups?.length === 0)
    expect(current()?.opposition).toHaveLength(3)
    expect(current()?.opposition.every((o) => o.groupId === undefined)).toBe(true)
  })
})

describe("an encounter's briefing", () => {
  test('saves what the Pilots see, apart from the notes', async () => {
    await renderPage()
    expect(screen.getByText('Players see this')).toBeTruthy()
    await click(screen.getByRole('button', { name: 'Edit what the pilots see' }))
    const input = screen.getByLabelText(/what the pilots see/i, {
      selector: 'textarea',
    }) as HTMLTextAreaElement
    await act(async () => {
      fireEvent.change(input, { target: { value: 'Smoke rises from the crusher.' } })
      fireEvent.blur(input)
    })
    await settle(() => current()?.briefing !== undefined)
    expect(current()?.briefing).toBe('Smoke rises from the crusher.')
    expect(current()?.notes).toBe('')
  })
})

describe("an encounter's threat read and spoils", () => {
  test('reads the opposition against a crew the Mediator steps', async () => {
    await renderPage()
    const read = screen.getByRole('region', { name: 'Threat read' })
    expect(within(read).getByText('HP')).toBeTruthy()
    expect(within(read).queryByText('Crew outnumbered')).toBeNull()
    await click(within(read).getByRole('button', { name: 'Decrease crew size' }))
    await click(within(read).getByRole('button', { name: 'Decrease crew size' }))
    expect(within(read).getByText('Crew outnumbered')).toBeTruthy()
  })

  test('lists what could be salvaged, or says nothing here leaves any', async () => {
    await renderPage()
    expect(screen.getByText(/Nothing here leaves salvage in the book/)).toBeTruthy()
    act(() => {
      useEncounters.setState({
        encounters: [
          {
            ...AMBUSH,
            opposition: [
              {
                id: 'm1',
                refSchema: 'chassis',
                refSlug: 'mule',
                refName: 'Mule',
                refPattern: 'hauler',
                name: 'Hauler',
                maxHp: 10,
                statKind: 'sp',
              },
            ],
          },
        ],
      } as never)
    })
    const spoils = screen.getByRole('list', { name: 'Spoils' })
    expect(within(spoils).getByText('Mule Chassis · Tech 1 · Salvage Value 7')).toBeTruthy()
    expect(within(spoils).getByText(/Comms Module/)).toBeTruthy()
  })
})
