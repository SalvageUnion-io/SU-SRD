/**
 * Tests for DowntimeWizard — the guided Downtime loop on the light display.
 *
 * Verifies the wizard is driven from the real "Crawler Downtime" Guide in the
 * reference ORM (not a hard-coded array): it renders the current step's name +
 * phase, advances with Next/Prev, and the ephemeral "Mark Complete" toggle
 * flips through playStateStore. Reference content needs the ORM, so
 * preload('all') runs once.
 */

import { beforeEach, describe, expect, test } from 'bun:test'
import { fireEvent, render } from '@testing-library/react'
import { EntityHrefProvider } from 'component-lib'
import { SalvageUnionReference } from 'salvageunion-reference'
import { usePlayStateStore } from '../../../stores/playStateStore'
import { crawlerFixture } from '../../__tests__/fixtures'
import { DowntimeWizard } from '../DowntimeWizard'

beforeEach(() => {
  usePlayStateStore.setState({
    mount: 'downtime',
    wheel: 0,
    priorMount: 'mech',
    dtStep: 0,
    dtDone: {},
  })
})

const crawler = crawlerFixture({ id: 'c1', name: 'Hauler', techLevel: '3', crawlerBays: [] })

function renderWizard() {
  return render(
    <EntityHrefProvider value={() => undefined}>
      <DowntimeWizard crawler={crawler} />
    </EntityHrefProvider>
  )
}

describe('DowntimeWizard', () => {
  test('drives the first step from the reference guide (name + phase)', () => {
    const { container } = renderWizard()
    expect(container.querySelector('.pc-dt')).toBeTruthy()
    // Step 1 of the SRD procedure is "Tally Salvage" in the Post-Session phase.
    expect(container.textContent).toContain('Tally Salvage')
    expect(container.querySelector('.pc-dt-head')?.firstElementChild?.textContent).toBe(
      'Post-Session'
    )
    expect(container.querySelector('.pc-dt-count')?.textContent).toContain('Step 1 /')
  })

  test('Next advances the step; Prev is disabled on the first step', () => {
    const { container, getByText } = renderWizard()
    const prev = getByText('‹ Prev') as HTMLButtonElement
    expect(prev.disabled).toBe(true)
    fireEvent.click(getByText('Next ›'))
    expect(usePlayStateStore.getState().dtStep).toBe(1)
    expect(container.querySelector('.pc-dt-count')?.textContent).toContain('Step 2 /')
  })

  test('Mark Complete toggles the ephemeral per-step flag', () => {
    const { getByText } = renderWizard()
    fireEvent.click(getByText('Mark Complete'))
    expect(usePlayStateStore.getState().dtDone[0]).toBe(true)
    // Re-render reflects the completed label.
    expect(getByText('✓ Complete')).toBeTruthy()
  })

  test('Trade step renders its reused RollTable (Trading Bay)', () => {
    // Find the Trade step index from the guide and jump to it.
    const guide = SalvageUnionReference.Guides.find((g) => g.guideType === 'downtime')
    const idx = (guide?.steps ?? []).findIndex((s) => s.name === 'Trade')
    expect(idx).toBeGreaterThan(-1)
    usePlayStateStore.setState({ dtStep: idx })
    const { container } = renderWizard()
    expect(container.textContent).toContain('Trade')
    expect(container.querySelector('.pc-dt-table table')).toBeTruthy()
  })
})
