/**
 * Tests for EditableStatRow.
 *
 * Covers:
 * - Save invokes store.update with the correct field patch shape.
 * - Soft warnings render via SoftWarningBanner when evaluate returns warnings.
 * - "Fix it" dismisses the banner without re-saving.
 *
 * Uses dep-injection (store, evaluate stubs). No mock.module(). toBeTruthy() not toBeInTheDocument().
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

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const fakeMech: Mech = {
  id: 'mech-1',
  schemaVersion: 1,
  name: 'Test Mech',
  chassisRef: 'iron-mongrel',
  systems: [],
  modules: [],
  cargo: [],
  conditions: [],
  currentHP: 10,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
}

/**
 * Build a minimal store stub that satisfies the useEntityStore shape.
 * Only `get` and `update` are called by EditableStatRow / useSoftWarnings.
 */
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

/** Evaluate stub that always returns no warnings. */
function noWarnings(): SoftWarning[] {
  return []
}

/** Evaluate stub that always returns one warning. */
function oneWarning(): SoftWarning[] {
  return [{ code: 'TEST_WARN', message: 'This is a test warning.', severity: 'warn' }]
}

// ---------------------------------------------------------------------------
// Store update shape
// ---------------------------------------------------------------------------

describe('EditableStatRow — store update', () => {
  test('saving calls store.update with the correct field patch', async () => {
    const captured: Array<{ id: string; patch: Partial<Mech> }> = []
    const store = makeStore([fakeMech], (id, patch) => captured.push({ id, patch }))

    render(
      <EditableStatRow
        label="HP"
        value={10}
        entityKind="mech"
        entityId="mech-1"
        fieldPath="currentHP"
        min={0}
        store={store}
        evaluate={noWarnings}
      />
    )

    // Click the value to enter edit mode
    await act(async () => {
      fireEvent.click(screen.getByRole('button'))
    })

    const input = screen.getByRole('spinbutton')
    await act(async () => {
      fireEvent.change(input, { target: { value: '7' } })
      fireEvent.keyDown(input, { key: 'Enter' })
    })

    expect(captured.length).toBe(1)
    expect(captured[0]!.id).toBe('mech-1')
    expect(captured[0]!.patch).toMatchObject({ currentHP: 7 })
  })
})

// ---------------------------------------------------------------------------
// Soft warnings
// ---------------------------------------------------------------------------

describe('EditableStatRow — soft warnings', () => {
  test('SoftWarningBanner renders when evaluate returns warnings', async () => {
    const store = makeStore([fakeMech])

    render(
      <EditableStatRow
        label="HP"
        value={10}
        entityKind="mech"
        entityId="mech-1"
        fieldPath="currentHP"
        min={0}
        store={store}
        evaluate={oneWarning}
      />
    )

    await act(async () => {
      fireEvent.click(screen.getByRole('button'))
    })

    const input = screen.getByRole('spinbutton')
    await act(async () => {
      fireEvent.change(input, { target: { value: '5' } })
      fireEvent.keyDown(input, { key: 'Enter' })
    })

    expect(screen.getByText('This is a test warning.')).toBeTruthy()
    expect(screen.getByRole('button', { name: /save anyway/i })).toBeTruthy()
    expect(screen.getByRole('button', { name: /fix it/i })).toBeTruthy()
  })

  test('"Fix it" dismisses the banner', async () => {
    const store = makeStore([fakeMech])

    render(
      <EditableStatRow
        label="HP"
        value={10}
        entityKind="mech"
        entityId="mech-1"
        fieldPath="currentHP"
        min={0}
        store={store}
        evaluate={oneWarning}
      />
    )

    // Trigger save to get warnings
    await act(async () => {
      fireEvent.click(screen.getByRole('button'))
    })
    const input = screen.getByRole('spinbutton')
    await act(async () => {
      fireEvent.change(input, { target: { value: '5' } })
      fireEvent.keyDown(input, { key: 'Enter' })
    })

    expect(screen.getByText('This is a test warning.')).toBeTruthy()

    // Click "Fix it"
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /fix it/i }))
    })

    expect(screen.queryByText('This is a test warning.')).toBeNull()
  })

  test('no SoftWarningBanner rendered when evaluate returns no warnings', async () => {
    const store = makeStore([fakeMech])

    render(
      <EditableStatRow
        label="HP"
        value={10}
        entityKind="mech"
        entityId="mech-1"
        fieldPath="currentHP"
        min={0}
        store={store}
        evaluate={noWarnings}
      />
    )

    await act(async () => {
      fireEvent.click(screen.getByRole('button'))
    })

    const input = screen.getByRole('spinbutton')
    await act(async () => {
      fireEvent.change(input, { target: { value: '8' } })
      fireEvent.keyDown(input, { key: 'Enter' })
    })

    expect(screen.queryByRole('alert')).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// Label rendering
// ---------------------------------------------------------------------------

describe('EditableStatRow — label', () => {
  test('renders label text', () => {
    const store = makeStore([fakeMech])
    render(
      <EditableStatRow
        label="Heat"
        value={5}
        entityKind="mech"
        entityId="mech-1"
        fieldPath="currentHeat"
        store={store}
        evaluate={noWarnings}
      />
    )
    expect(screen.getByText('Heat')).toBeTruthy()
  })
})
