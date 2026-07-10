/**
 * MechConditionsEditor — unified conditions vocabulary (plan 4.5, gap 21).
 *
 * The editor renders ONE list (conditions[] + automation flags merged via
 * unifiedMechConditions) and maps edits back: removing a flag chip clears
 * the boolean flag (gap 8 manual clear), adds/removes round-trip
 * conditions[]. readOnly renders plain chips.
 */

import { afterEach, describe, expect, mock, test } from 'bun:test'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'

import { MechConditionsEditor } from '../MechConditionsEditor'
import type { Mech } from '../../../lib/schemas/mech'
import type { useEntityStore } from '../../../stores/entityStore'
import { must } from '../../__tests__/must'

afterEach(() => {
  cleanup()
})

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
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  }
}

type CapturedUpdate = { patch: Partial<Mech> }

function makeStore(mech: Mech, captured: CapturedUpdate[]): typeof useEntityStore {
  const storeState = {
    pilots: [],
    mechs: [mech],
    crawlers: [],
    softLinks: [],
    hydrated: { pilots: false, mechs: true, crawlers: false, softLinks: false },
    hydrate: mock(async () => {}),
    list: mock(() => [mech]),

    get: mock((_type: string, id: string) => (id === mech.id ? mech : null)),
    create: mock(async () => mech),
    update: mock(async (_type: string, _id: string, patch: Partial<Mech>) => {
      captured.push({ patch })
      return mech
    }),
    delete: mock(async () => {}),
  }
  return (() => storeState) as unknown as typeof useEntityStore
}

describe('MechConditionsEditor', () => {
  test('renders the unified vocabulary: conditions[] + flags as one list', () => {
    const mech = makeMech({
      conditions: ['Prone'],
      shutdown: true,
      vulnerable: true,
    })
    render(<MechConditionsEditor mech={mech} store={makeStore(mech, [])} />)

    expect(screen.getByText('Prone')).toBeTruthy()
    expect(screen.getByText('Shutdown')).toBeTruthy()
    expect(screen.getByText('Vulnerable')).toBeTruthy()
  })

  test('removing the Shutdown chip clears the flag (manual clear)', async () => {
    const captured: CapturedUpdate[] = []
    const mech = makeMech({ conditions: ['Prone'], shutdown: true })
    render(<MechConditionsEditor mech={mech} store={makeStore(mech, captured)} />)

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /remove condition shutdown/i }))
    })

    expect(must(captured[0]).patch).toEqual({
      shutdown: false,
      conditions: ['Prone'],
    })
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

  test('readOnly renders plain chips — no remove, no add', () => {
    const mech = makeMech({ conditions: ['Prone'], shutdown: true })
    render(<MechConditionsEditor mech={mech} store={makeStore(mech, [])} readOnly />)

    expect(screen.getByText('Prone')).toBeTruthy()
    expect(screen.queryByRole('button')).toBeNull()
  })
})
