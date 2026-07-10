/**
 * HeatCheckControl — Push button danger escalation (design review U-1).
 *
 * The "Push (+2 Heat)" button keeps the default paper/ink treatment while heat
 * is comfortably low, and flips to the `danger` Btn variant once current heat
 * reaches ~70% of the cap (and stays there at cap) so pushing at high heat
 * reads as risky.
 *
 * Conventions: toBeTruthy() not toBeInTheDocument(), dep-injection not mock.module().
 */

import { afterEach, describe, expect, mock, test } from 'bun:test'
import { cleanup, render, screen } from '@testing-library/react'

import { HeatCheckControl } from '../HeatCheckControl'
import type { Mech } from '../../../lib/schemas/mech'
import type { useEntityStore } from '../../../stores/entityStore'

afterEach(cleanup)

const baseMech: Mech = {
  id: 'mech-heat-esc-1',
  schemaVersion: 1,
  name: 'Escalation Test Mech',
  chassisRef: 'iron-mongrel',
  systems: [],
  modules: [],
  cargoLots: [],
  conditions: [],
  currentHP: 12,
  currentSP: 10,
  currentHeat: 0,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
}

function makeStore(mech: Mech): typeof useEntityStore {
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
    update: mock(async () => mech),
    delete: mock(async () => {}),
  }
  return (() => storeState) as unknown as typeof useEntityStore
}

function pushButton() {
  const btn = screen
    .getAllByRole('button')
    .find((b) => b.textContent?.toLowerCase().includes('push'))
  if (!btn) throw new Error('Push button not found')
  return btn
}

function renderControl(currentHeat: number, heatCap = 10) {
  const mech = { ...baseMech, currentHeat }
  render(
    <HeatCheckControl
      mech={mech}
      heatCap={heatCap}
      currentSP={10}
      currentHeat={currentHeat}
      store={makeStore(mech)}
    />
  )
}

describe('HeatCheckControl — Push escalation (U-1)', () => {
  test('below ~70% of cap Push keeps the default treatment', () => {
    renderControl(6)
    const btn = pushButton()
    expect(btn.className).not.toContain('bg-danger')
    expect(btn.className).toContain('bg-paper')
  })

  test('at >= ~70% of cap Push flips to the danger variant', () => {
    renderControl(7)
    expect(pushButton().className).toContain('bg-danger')
  })

  test('at cap Push stays danger-styled', () => {
    renderControl(10)
    expect(pushButton().className).toContain('bg-danger')
  })

  test('inert when the cap is not positive', () => {
    renderControl(6, 0)
    expect(pushButton().className).not.toContain('bg-danger')
  })
})
