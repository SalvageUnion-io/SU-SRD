/**
 * SavePatternDialog — save a mech's build as a pattern, shown as its chassis
 * lists its patterns, in Edit.
 *
 * Pins the flow: it opens on the mech's name, the pattern listed with its
 * HOMEBREW stamp and loadout, a blank name is not saved, Enter or Save stores
 * the chassis, loadout and description (never cargo) and hands its id back,
 * Cancel writes nothing, and a failed save keeps the dialog open saying so.
 */

import { afterAll, beforeEach, describe, expect, mock, test } from 'bun:test'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { useState } from 'react'
import { acceptingRooms, roomAnswer } from '../../../../../test/roomsStub'
import { installServerMocks } from '../../../../components/__tests__/serverMock'
import { withSignedInBackend } from '../../../../replica/__tests__/signedInBackend'

// Module scope, before the imports below — see `serverMock.ts`: the router;
// a pattern is saved through the stand-in account room (`test/roomsStub.ts`).
const serverMocks = await installServerMocks()
afterAll(() => serverMocks.restore())

const { resetStores } = await import('../../../../replica/__tests__/resetStores')
const { usePatterns } = await import('../../../../replica/collections')
const { SavePatternButton } = await import('../SavePatternButton')
const { SavePatternDialog } = await import('../SavePatternDialog')

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
        <SavePatternDialog
          source={SOURCE}
          open={isOpen}
          onOpenChange={setOpen}
          onSaved={onSaved}
          stay
        />
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
  await usePatterns.getState().hydrate()
})

describe('SavePatternDialog', () => {
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
      cargoLots: [],
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
    render(<SavePatternButton source={SOURCE} />)
    await open()
    expect(nameField().value).toBe('Iron Jaw')
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Save pattern' }))
    })
    await waitFor(() => expect(usePatterns.getState().mechPatterns).toHaveLength(1))
    expect(serverMocks.navigations).toHaveLength(0)
  })
})
