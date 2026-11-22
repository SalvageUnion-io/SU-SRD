/**
 * SavePatternDialog — save a mech's build as a pattern, shown as its chassis
 * lists its patterns, in Edit.
 *
 * Pins the flow: it opens on the mech's name, the pattern listed with its
 * HOMEBREW stamp and loadout, a blank name is not saved, Enter or Save stores
 * the chassis, loadout and description (never cargo) and hands its id back,
 * Cancel writes nothing, and a failed save keeps the dialog open saying so.
 */

import { afterAll, beforeEach, describe, expect, mock, spyOn, test } from 'bun:test'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { useState } from 'react'
import { acceptingRooms, roomAnswer } from '../../../../../test/roomsStub'
import { installServerMocks } from '../../../../components/__tests__/serverMock'
import { withSignedInBackend } from '../../../../replica/__tests__/signedInBackend'

// Module scope, before the imports below — see `serverMock.ts`: the router;
// a pattern is saved through the stand-in account room (`test/roomsStub.ts`).
const serverMocks = await installServerMocks()
afterAll(() => serverMocks.restore())

const { ToasterMount, toast } = await import('../../../../components/index')
const { resetStores } = await import('../../../../replica/__tests__/resetStores')
const { usePatterns } = await import('../../../../replica/collections')
const { SavePatternButton } = await import('../SavePatternButton')
const { SavePatternDialog } = await import('../SavePatternDialog')
const { patternToReplace } = await import('../buildConfirm.model')

withSignedInBackend()

const SOURCE = {
  name: 'Iron Jaw',
  chassisRef: 'mule',
  systems: ['red-laser'],
  modules: ['comms-module'],
}

function renderButton() {
  const onSaved = mock((_id: string) => {})
  function Harness() {
    const [isOpen, setOpen] = useState(false)
    return (
      <>
        <button type="button" onClick={() => setOpen(true)}>
          Save as pattern
        </button>
        <SavePatternDialog source={SOURCE} open={isOpen} onOpenChange={setOpen} onSaved={onSaved} />
      </>
    )
  }
  render(<Harness />)
  return onSaved
}

async function open() {
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Save as pattern' }))
  })
}

const nameField = () => screen.getByRole('textbox', { name: 'Pattern name' }) as HTMLInputElement

async function typeName(value: string) {
  await act(async () => {
    fireEvent.change(nameField(), { target: { value } })
  })
}

beforeEach(async () => {
  acceptingRooms()
  resetStores()
  toast.dismiss()
  serverMocks.navigations.length = 0
  await usePatterns.getState().hydrate()
})

describe('SavePatternDialog', () => {
  test('the summary and Save sit above the loadout rules cards (r3 L5)', async () => {
    renderButton()
    await open()
    const save = screen.getByRole('button', { name: 'Save pattern' })
    const part = screen.getAllByText('Red Laser')[0] as HTMLElement
    expect(save.compareDocumentPosition(part) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  test('opens on the mech’s name, and Save stores the build as a pattern', async () => {
    const onSaved = renderButton()
    await open()
    expect(nameField().value).toBe('Iron Jaw')

    await typeName('  Brawler  ')
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Save pattern' }))
    })

    await waitFor(() => expect(usePatterns.getState().mechPatterns).toHaveLength(1))
    const [saved] = usePatterns.getState().mechPatterns
    expect(saved).toMatchObject({
      name: 'Brawler',
      chassisRef: 'mule',
      systems: ['red-laser'],
      modules: ['comms-module'],
    })
    expect(onSaved).toHaveBeenCalledWith(saved?.id)
    await waitFor(() => expect(screen.queryByRole('textbox', { name: 'Pattern name' })).toBeNull())
  })

  test('lists the pattern as its chassis would, with its HOMEBREW stamp, its loadout and a description in Edit', async () => {
    renderButton()
    await open()
    expect(screen.getAllByText('Homebrew').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Red Laser').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Comms Module').length).toBeGreaterThan(0)
    await act(async () => {
      fireEvent.change(screen.getByRole('textbox', { name: 'Pattern description' }), {
        target: { value: 'Rig first, rivet later.' },
      })
    })
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Save pattern' }))
    })
    await waitFor(() => expect(usePatterns.getState().mechPatterns).toHaveLength(1))
    expect(usePatterns.getState().mechPatterns[0]?.notes).toBe('Rig first, rivet later.')
  })

  test('a name a pattern already has is asked about once, then saved as a second (r4 E13)', async () => {
    await usePatterns
      .getState()
      .create({ schemaVersion: 1, name: 'Iron Jaw', chassisRef: 'mule', systems: [], modules: [] })
    renderButton()
    await open()
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Save pattern' }))
    })
    expect(
      screen.getByText(/You already have a pattern named “Iron Jaw”\..*save a second/)
    ).toBeTruthy()
    expect(usePatterns.getState().mechPatterns).toHaveLength(1)
    // A changed name withdraws the ask; back on the taken one, it is asked again.
    await typeName('Iron Jaw Mk II')
    expect(screen.queryByText(/save a second pattern/i)).toBeNull()
    await typeName('iron jaw ')
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Save pattern' }))
    })
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Save a second' }))
    })
    await waitFor(() => expect(usePatterns.getState().mechPatterns).toHaveLength(2))
  })

  test('a taken name offers Replace: the pattern keeps its id and description, and Undo puts it back (r5 D1)', async () => {
    render(<ToasterMount />)
    const held = await usePatterns.getState().create({
      schemaVersion: 1,
      name: 'Iron Jaw',
      chassisRef: 'mule',
      systems: [],
      modules: [],
      notes: 'The first cut.',
    })
    renderButton()
    await open()
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Save pattern' }))
    })
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Replace Iron Jaw' }))
    })
    await waitFor(() =>
      expect(usePatterns.getState().mechPatterns[0]?.systems).toEqual(['red-laser'])
    )
    expect(usePatterns.getState().mechPatterns).toHaveLength(1)
    expect(usePatterns.getState().mechPatterns[0]).toMatchObject({
      id: held.id,
      notes: 'The first cut.',
      modules: ['comms-module'],
    })
    expect(await screen.findByText('Replaced pattern Iron Jaw.')).toBeTruthy()
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Undo' }))
    })
    await waitFor(() => expect(usePatterns.getState().mechPatterns[0]?.systems).toEqual([]))
  })

  test('two patterns of the name: Replace is offered only for the one the mech was built from (r5 D1)', async () => {
    const make = () =>
      usePatterns.getState().create({
        schemaVersion: 1,
        name: 'Iron Jaw',
        chassisRef: 'mule',
        systems: [],
        modules: [],
      })
    await make()
    const second = await make()
    expect(patternToReplace('iron jaw', usePatterns.getState().mechPatterns, undefined)).toBe(
      undefined
    )
    expect(patternToReplace(' Iron Jaw', usePatterns.getState().mechPatterns, second.id)?.id).toBe(
      second.id
    )
  })

  test('saving stays where it was asked, and its notice opens the pattern (r4 E19)', async () => {
    render(<ToasterMount />)
    renderButton()
    await open()
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Save pattern' }))
    })
    await waitFor(() => expect(usePatterns.getState().mechPatterns).toHaveLength(1))
    expect(serverMocks.navigations).toHaveLength(0)
    expect(await screen.findByText('Saved pattern Iron Jaw.')).toBeTruthy()
    const went: string[] = []
    const assign = spyOn(window.location, 'assign').mockImplementation((to: string | URL) => {
      went.push(String(to))
    })
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Open the pattern' }))
    })
    assign.mockRestore()
    expect(went).toEqual([`/p/pattern/${usePatterns.getState().mechPatterns[0]?.id}`])
  })

  test('Enter saves too', async () => {
    renderButton()
    await open()
    await act(async () => {
      fireEvent.keyDown(nameField(), { key: 'Enter' })
    })
    await waitFor(() => expect(usePatterns.getState().mechPatterns).toHaveLength(1))
    expect(usePatterns.getState().mechPatterns[0]?.name).toBe('Iron Jaw')
  })

  test('a blank name is refused, and Save is closed until there is one', async () => {
    renderButton()
    await open()
    await typeName('   ')
    expect(screen.getByRole('button', { name: 'Save pattern' }).hasAttribute('disabled')).toBe(true)
    await act(async () => {
      fireEvent.keyDown(nameField(), { key: 'Enter' })
    })
    expect(usePatterns.getState().mechPatterns).toHaveLength(0)
    expect(usePatterns.getState().mechPatterns).toHaveLength(0)
  })

  test('Cancel closes, writing nothing', async () => {
    const onSaved = renderButton()
    await open()
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    })
    await waitFor(() => expect(screen.queryByRole('textbox', { name: 'Pattern name' })).toBeNull())
    expect(usePatterns.getState().mechPatterns).toHaveLength(0)
    expect(onSaved).not.toHaveBeenCalled()
  })

  test('a failed save keeps the dialog open and says so; reopening clears it', async () => {
    roomAnswer.act = async () => {
      throw new Error('socket closed')
    }
    const onSaved = renderButton()
    await open()
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Save pattern' }))
    })
    expect(await screen.findByText('The pattern could not be saved. Try again.')).toBeTruthy()
    expect(nameField()).toBeTruthy()
    expect(onSaved).not.toHaveBeenCalled()

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    })
    await open()
    expect(screen.queryByText('The pattern could not be saved. Try again.')).toBeNull()
  })
})

describe('SavePatternButton', () => {
  test('the builder opens the same dialog, and stays put once it lands', async () => {
    render(<SavePatternButton source={SOURCE} askSignIn={undefined} />)
    await open()
    expect(nameField().value).toBe('Iron Jaw')
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Save pattern' }))
    })
    await waitFor(() => expect(usePatterns.getState().mechPatterns).toHaveLength(1))
    expect(serverMocks.navigations).toHaveLength(0)
  })

  test('signed out it asks for the sign-in at once, before any typing (r4 E15)', async () => {
    const askSignIn = mock(() => {})
    render(<SavePatternButton source={SOURCE} askSignIn={askSignIn} />)
    await open()
    expect(askSignIn).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('textbox', { name: 'Pattern name' })).toBeNull()
  })
})
