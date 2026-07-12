/**
 * Tests for ActionsDeck — the Phase-5 actions resolve flow on the light display.
 * Verifies the grouped list renders from the real ORM, selecting an action opens
 * the resolve panel, and Activate writes the EP/uses patch through the store
 * (asserted via a stub store).
 *
 * Reference content needs the ORM, so preload('all') runs once. A system with a
 * real EP cost is picked from the loaded set so the Activate write is exercised.
 */

import { beforeAll, describe, expect, test } from 'bun:test'
import { fireEvent, render, screen } from '@testing-library/react'
import { EntityHrefProvider } from 'suref-react'
import { SalvageUnionReference } from 'salvageunion-reference'

import type { Mech } from '../../../lib/schemas/mech'
import { itemEconomy, resolveSystem } from '../../sheet/mechItemRules'
import { ActionsDeck } from '../ActionsDeck'
import type { PlayStore } from '../ActiveItemBand'

type Call = { type: string; id: string; patch: Record<string, unknown> }

function stubStore(mech: Mech): { store: PlayStore; calls: Call[] } {
  const calls: Call[] = []
  const store = {
    get: (_type: string, id: string) => (id === mech.id ? mech : null),
    update: async (type: string, id: string, patch: Record<string, unknown>) => {
      calls.push({ type, id, patch })
      return mech
    },
  } as unknown as PlayStore
  return { store, calls }
}

let costedSystemId = ''

beforeAll(async () => {
  await SalvageUnionReference.preload('all')
  // A system whose primary action costs EP → Activate produces a currentEP patch.
  for (const sys of SalvageUnionReference.Systems.all() as Array<{ id?: string }>) {
    if (!sys.id) continue
    const resolved = resolveSystem(sys.id)
    if (resolved && itemEconomy(resolved).epCost > 0) {
      costedSystemId = sys.id
      break
    }
  }
})

function makeMech(): Mech {
  return {
    id: 'm1',
    name: 'Rig',
    chassisRef: 'unknown-chassis',
    systems: [costedSystemId],
    modules: [],
    currentEP: 6,
    currentHeat: 0,
  } as unknown as Mech
}

function renderDeck(mech: Mech, store: PlayStore) {
  return render(
    <EntityHrefProvider value={() => undefined}>
      <ActionsDeck mech={mech} store={store} />
    </EntityHrefProvider>
  )
}

describe('ActionsDeck', () => {
  test('lists installed systems under a Systems group', () => {
    expect(costedSystemId).toBeTruthy()
    const mech = makeMech()
    const { store } = stubStore(mech)
    renderDeck(mech, store)
    expect(screen.getByText('Systems')).toBeTruthy()
  })

  test('selecting an action opens the resolve panel with Activate', () => {
    const mech = makeMech()
    const { store } = stubStore(mech)
    renderDeck(mech, store)
    const item = resolveSystem(costedSystemId)
    fireEvent.click(screen.getByText(item?.name ?? ''))
    expect(screen.getByText('Activate')).toBeTruthy()
    expect(screen.getByText('Roll')).toBeTruthy()
  })

  test('Activate writes the EP-spend patch through the store', () => {
    const mech = makeMech()
    const { store, calls } = stubStore(mech)
    renderDeck(mech, store)
    const item = resolveSystem(costedSystemId)
    const economy = item ? itemEconomy(item) : { epCost: 0, heat: 0, maxUses: 0 }
    fireEvent.click(screen.getByText(item?.name ?? ''))
    fireEvent.click(screen.getByText('Activate'))
    expect(calls).toHaveLength(1)
    expect(calls[0]?.type).toBe('mech')
    expect(calls[0]?.patch.currentEP).toBe(Math.max(0, 6 - economy.epCost))
  })

  test('Roll shows a Core Mechanic band readout', () => {
    const mech = makeMech()
    const { store } = stubStore(mech)
    const { container } = renderDeck(mech, store)
    const item = resolveSystem(costedSystemId)
    fireEvent.click(screen.getByText(item?.name ?? ''))
    expect(container.querySelector('.pc-deck-roll')).toBeNull()
    fireEvent.click(screen.getByText('Roll'))
    expect(container.querySelector('.pc-deck-roll')).toBeTruthy()
    expect(container.querySelector('.pc-deck-d20')).toBeTruthy()
  })
})
