/**
 * Shared fixtures for the EntitySearcher suite, split across
 * `EntitySearcher*.test.tsx` so the parallel runner can spread the pool renders
 * over its workers. EntitySearcher.test.tsx carries the suite's contract.
 */

import { act, fireEvent, screen, within } from '@testing-library/react'
import { useState } from 'react'
import { SalvageUnionReference } from 'salvageunion-reference'
import { EntitySearcher } from '../EntitySearcher'

export type Equip = { id: string; name: string; techLevel: number | 'B' | 'N' }

export function allEquipment(): Equip[] {
  return SalvageUnionReference.Equipment.all()
}

export function nth(list: Equip[], i: number): Equip {
  const item = list[i]
  if (!item) throw new Error(`No equipment at index ${i} in reference data`)
  return item
}

/** Three equipment items with distinct names, so their Remove buttons differ. */
export function threeEquipment(): [Equip, Equip, Equip] {
  const byName = new Map(allEquipment().map((e) => [e.name, e]))
  const [a, b, c] = [...byName.values()]
  if (!a || !b || !c) throw new Error('Need three distinctly-named equipment items')
  return [a, b, c]
}

/** The caller owns `selected` (ADR-010) — a stateful harness, like a sheet. */
export function ControlledEquipment({ initial }: { initial: string[] }) {
  const [selected, setSelected] = useState(initial)
  return (
    <EntitySearcher
      schema="equipment"
      selected={selected}
      onToggle={(ref) =>
        setSelected((s) => (s.includes(ref) ? s.filter((r) => r !== ref) : [...s, ref]))
      }
      idOf={(i) => i.id}
      chosenLabel="Equipped"
    />
  )
}

export function rail(name: RegExp | string = /equipped/i): HTMLElement {
  return screen.getByRole('region', { name })
}

/** Open the narrow band's disclosure and return it. */
export function expand(region: HTMLElement): HTMLElement {
  const toggle = within(region).getByRole('button', { expanded: false })
  fireEvent.click(toggle)
  return toggle
}

type HappyWindow = {
  happyDOM: { setViewport: (size: { width: number; height: number }) => void }
}

/** Inside `act()`: a resize fires matchMedia `change`, and the searcher — still
 * mounted when an `afterEach` runs — re-renders through `useWideRail`. */
export function setViewport(width: number, height: number) {
  act(() => {
    ;(window as unknown as HappyWindow).happyDOM.setViewport({ width, height })
  })
}

// Every test renders the whole pool (the full equipment or chassis catalog),
// about 1 s alone but past the default 5 s once the pre-push gates and every
// workspace's suite share the cores.
export const POOL_RENDER_MS = 20_000
