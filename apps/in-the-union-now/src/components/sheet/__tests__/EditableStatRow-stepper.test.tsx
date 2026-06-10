/**
 * Tests for EditableStatRow stepper buttons (Slice D).
 *
 * Covers:
 * - + / - buttons apply a clamped delta via store.update.
 * - The decrement floors at `min` (button disabled at min).
 * - The increment caps at `max` (button disabled at max).
 * - Steppers are absent when `step` is omitted and when readOnly.
 *
 * Uses dep-injection (store, evaluate stubs). No mock.module().
 */

import { afterEach, describe, expect, mock, test } from 'bun:test'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'

import { EditableStatRow } from '../EditableStatRow'
import type { useEntityStore } from '../../../stores/entityStore'
import type { Mech } from '../../../lib/schemas/mech'
import type { SoftWarning } from '../../../lib/rules/types'

afterEach(() => {
  cleanup()
})

const fakeMech: Mech = {
  id: 'mech-1',
  schemaVersion: 1,
  name: 'Test Mech',
  chassisRef: 'iron-mongrel',
  systems: [],
  modules: [],
  cargoLots: [],
  conditions: [],
  currentHP: 10,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
}

function makeStore(
  entities: Mech[],
  onUpdate?: (id: string, patch: Partial<Mech>) => void
): typeof useEntityStore {
  const updateMock = mock(async (_type: string, id: string, patch: Partial<Mech>) => {
    onUpdate?.(id, patch)
    const entity = entities.find((e) => e.id === id)
    return { ...entity, ...patch } as Mech
  })

  const storeState = {
    pilots: [],
    mechs: entities,
    crawlers: [],
    softLinks: [],
    hydrated: { pilots: false, mechs: true, crawlers: false, softLinks: false },
    hydrate: mock(async () => {}),
    list: mock(() => entities),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    get: mock((_type: string, id: string) => entities.find((e) => e.id === id) ?? null) as any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    create: mock(async () => entities[0]) as any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    update: updateMock as any,
    delete: mock(async () => {}),
  }

  return (() => storeState) as unknown as typeof useEntityStore
}

function noWarnings(): SoftWarning[] {
  return []
}

describe('EditableStatRow — steppers (Slice D)', () => {
  test('decrement button applies a -step delta', async () => {
    const captured: Array<{ id: string; patch: Partial<Mech> }> = []
    const store = makeStore([fakeMech], (id, patch) => captured.push({ id, patch }))

    render(
      <EditableStatRow
        label="SP"
        value={10}
        entityKind="mech"
        entityId="mech-1"
        fieldPath="currentSP"
        min={0}
        step={1}
        store={store}
        evaluate={noWarnings}
      />
    )

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /decrease sp by 1/i }))
    })

    expect(captured.length).toBe(1)
    expect(captured[0]!.patch).toMatchObject({ currentSP: 9 })
  })

  test('increment button applies a +step delta', async () => {
    const captured: Array<{ id: string; patch: Partial<Mech> }> = []
    const store = makeStore([fakeMech], (id, patch) => captured.push({ id, patch }))

    render(
      <EditableStatRow
        label="SP"
        value={10}
        entityKind="mech"
        entityId="mech-1"
        fieldPath="currentSP"
        min={0}
        max={20}
        step={1}
        store={store}
        evaluate={noWarnings}
      />
    )

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /increase sp by 1/i }))
    })

    expect(captured[0]!.patch).toMatchObject({ currentSP: 11 })
  })

  test('decrement is disabled and floors at min', async () => {
    const captured: Array<{ id: string; patch: Partial<Mech> }> = []
    const store = makeStore([{ ...fakeMech, currentSP: 0 }], (id, patch) =>
      captured.push({ id, patch })
    )

    render(
      <EditableStatRow
        label="SP"
        value={0}
        entityKind="mech"
        entityId="mech-1"
        fieldPath="currentSP"
        min={0}
        step={1}
        store={store}
        evaluate={noWarnings}
      />
    )

    const decBtn = screen.getByRole('button', { name: /decrease sp by 1/i }) as HTMLButtonElement
    expect(decBtn.disabled).toBe(true)

    await act(async () => {
      fireEvent.click(decBtn)
    })
    expect(captured.length).toBe(0)
  })

  test('increment is disabled at max (heat-cap clamp)', async () => {
    const captured: Array<{ id: string; patch: Partial<Mech> }> = []
    const store = makeStore([fakeMech], (id, patch) => captured.push({ id, patch }))

    render(
      <EditableStatRow
        label="Heat"
        value={6}
        entityKind="mech"
        entityId="mech-1"
        fieldPath="currentHeat"
        min={0}
        max={6}
        step={1}
        store={store}
        evaluate={noWarnings}
      />
    )

    const incBtn = screen.getByRole('button', {
      name: /increase heat by 1/i,
    }) as HTMLButtonElement
    expect(incBtn.disabled).toBe(true)

    await act(async () => {
      fireEvent.click(incBtn)
    })
    expect(captured.length).toBe(0)
  })

  test('no stepper buttons when step is omitted', () => {
    const store = makeStore([fakeMech])
    render(
      <EditableStatRow
        label="SP"
        value={10}
        entityKind="mech"
        entityId="mech-1"
        fieldPath="currentSP"
        min={0}
        store={store}
        evaluate={noWarnings}
      />
    )
    expect(screen.queryByRole('button', { name: /increase sp/i })).toBeNull()
    expect(screen.queryByRole('button', { name: /decrease sp/i })).toBeNull()
  })

  test('no stepper buttons when readOnly', () => {
    const store = makeStore([fakeMech])
    render(
      <EditableStatRow
        label="SP"
        value={10}
        entityKind="mech"
        entityId="mech-1"
        fieldPath="currentSP"
        min={0}
        step={1}
        readOnly
        store={store}
        evaluate={noWarnings}
      />
    )
    expect(screen.queryByRole('button', { name: /increase sp/i })).toBeNull()
    expect(screen.queryByRole('button', { name: /decrease sp/i })).toBeNull()
  })
})
