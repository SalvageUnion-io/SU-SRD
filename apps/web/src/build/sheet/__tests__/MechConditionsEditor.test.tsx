import { makeSingleUnitStore } from '../../../components/__tests__/mockEntityStore'
import type { UnitsStore } from '../../../replica/units'
/**
 * MechConditionsEditor — the mech's one conditions list. The Reactor's
 * Shutdown / Vulnerable / Destroyed are chips like any other: removing one is
 * the manual clear, and every edit writes `conditions[]`.
 */

import { describe, expect, test } from 'bun:test'
import { act, fireEvent, render, screen } from '@testing-library/react'
import type { Mech } from 'game-domain/schemas/mech'
import { FIXTURE_NOW } from '../../../components/__tests__/fixtures'
import { must } from '../../../components/__tests__/must'
import { MechConditionsEditor } from '../MechConditionsEditor'

function makeMech(overrides: Partial<Mech>): Mech {
  return {
    id: 'mech-cond-1',
    schemaVersion: 1,
    name: 'Condition Mech',
    chassisRef: 'whatever',
    systems: [],
    modules: [],
    cargoLots: [],
    conditions: [],
    createdAt: FIXTURE_NOW,
    updatedAt: FIXTURE_NOW,
    ...overrides,
  }
}

type CapturedUpdate = { patch: Partial<Mech> }

function makeStore(mech: Mech, captured: CapturedUpdate[]): UnitsStore {
  return makeSingleUnitStore('mech', mech, {
    update: async (_type, _id, patch) => {
      captured.push({ patch: patch as Partial<Mech> })
      return mech
    },
  })
}

describe('MechConditionsEditor', () => {
  test('renders the one list, Reactor labels included', () => {
    const mech = makeMech({ conditions: ['Prone', 'Shutdown', 'Vulnerable'] })
    render(<MechConditionsEditor mech={mech} store={makeStore(mech, [])} />)

    expect(screen.getByText('Prone')).toBeTruthy()
    expect(screen.getByText('Shutdown')).toBeTruthy()
    expect(screen.getByText('Vulnerable')).toBeTruthy()
  })

  test('removing the Shutdown chip clears it (manual clear)', async () => {
    const captured: CapturedUpdate[] = []
    const mech = makeMech({ conditions: ['Prone', 'Shutdown'] })
    render(<MechConditionsEditor mech={mech} store={makeStore(mech, captured)} />)

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /remove condition shutdown/i }))
    })

    expect(must(captured[0]).patch).toEqual({ conditions: ['Prone'] })
  })

  test('adding a free-form condition lands in conditions[]', async () => {
    const captured: CapturedUpdate[] = []
    const mech = makeMech({ conditions: [] })
    render(<MechConditionsEditor mech={mech} store={makeStore(mech, captured)} />)

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /add condition/i }))
    })
    const input = screen.getByLabelText('New condition')
    await act(async () => {
      fireEvent.change(input, { target: { value: 'Burn 2' } })
      fireEvent.keyDown(input, { key: 'Enter' })
    })

    expect(must(captured[0]).patch).toEqual({ conditions: ['Burn 2'] })
  })
})
