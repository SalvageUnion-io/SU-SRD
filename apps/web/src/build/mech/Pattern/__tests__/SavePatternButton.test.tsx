/**
 * SavePatternButton — capture a mech's build as a named pattern.
 *
 * Pins the dialog's flow: it opens on the mech's name, a blank name is not
 * saved, Enter or Save stores the pattern with the mech's configuration and
 * hands its id back, Cancel writes nothing, and a failed save keeps the
 * dialog open with a line saying so.
 */

import { afterAll, beforeEach, describe, expect, mock, test } from 'bun:test'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { CargoLot } from 'game-domain/schemas/cargoLot'
import { installConvexMocks } from '../../../../components/__tests__/convexMock'
import { withSignedInBackend } from '../../../../stores/__tests__/signedInBackend'

let failWrites = false

// Module scope, before the imports below — see `convexMock.ts`.
const convexMocks = await installConvexMocks({
  convexClient: {
    mutation: async () => {
      if (failWrites) throw new Error('socket closed')
      return { updatedAt: 1 }
    },
  },
})
afterAll(() => convexMocks.restore())

const { resetStores } = await import('../../../../stores/__tests__/resetStores')
const { usePatternStore } = await import('../../../../stores/patternStore')
const { SavePatternButton } = await import('../SavePatternButton')

withSignedInBackend()

const LOT: CargoLot = {
  id: 'l1',
  kind: 'unit',
  name: 'Crate',
  cat: 'SEALED',
  units: 1,
  code: 'CRA',
}

function renderButton() {
  const onSaved = mock((_id: string) => {})
  render(
    <SavePatternButton
      mechName="Iron Jaw"
      chassisRef="mule"
      systems={['red-laser']}
      modules={['ai-module']}
      cargoLots={[LOT]}
      onSaved={onSaved}
    />
  )
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
  failWrites = false
  resetStores()
  await usePatternStore.getState().hydrate()
})

describe('SavePatternButton', () => {
  test('opens on the mech’s name, and Save stores the build as a pattern', async () => {
    const onSaved = renderButton()
    await open()
    expect(nameField().value).toBe('Iron Jaw')

    await typeName('  Brawler  ')
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Save pattern' }))
    })

    await waitFor(() => expect(usePatternStore.getState().mechPatterns).toHaveLength(1))
    const [saved] = usePatternStore.getState().mechPatterns
    expect(saved).toMatchObject({
      name: 'Brawler',
      chassisRef: 'mule',
      systems: ['red-laser'],
      modules: ['ai-module'],
      cargoLots: [LOT],
    })
    expect(onSaved).toHaveBeenCalledWith(saved?.id)
    await waitFor(() => expect(screen.queryByRole('textbox', { name: 'Pattern name' })).toBeNull())
  })

  test('Enter saves too', async () => {
    renderButton()
    await open()
    await act(async () => {
      fireEvent.keyDown(nameField(), { key: 'Enter' })
    })
    await waitFor(() => expect(usePatternStore.getState().mechPatterns).toHaveLength(1))
    expect(usePatternStore.getState().mechPatterns[0]?.name).toBe('Iron Jaw')
  })

  test('a blank name is refused, and Save is closed until there is one', async () => {
    renderButton()
    await open()
    await typeName('   ')
    expect(screen.getByRole('button', { name: 'Save pattern' }).hasAttribute('disabled')).toBe(true)
    await act(async () => {
      fireEvent.keyDown(nameField(), { key: 'Enter' })
    })
    expect(screen.getByText('Pattern name is required.')).toBeTruthy()
    expect(usePatternStore.getState().mechPatterns).toHaveLength(0)
  })

  test('Cancel closes, writing nothing', async () => {
    const onSaved = renderButton()
    await open()
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    })
    await waitFor(() => expect(screen.queryByRole('textbox', { name: 'Pattern name' })).toBeNull())
    expect(usePatternStore.getState().mechPatterns).toHaveLength(0)
    expect(onSaved).not.toHaveBeenCalled()
  })

  test('a failed save keeps the dialog open and says so; reopening clears it', async () => {
    failWrites = true
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
