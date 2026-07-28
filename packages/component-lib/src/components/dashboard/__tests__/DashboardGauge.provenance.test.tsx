/**
 * The Dashboard used to silently DROP the gauge's override/provenance props:
 * `DashboardGauge` never forwarded them, and `VitalGauge`'s compact branch
 * returned before any of that chrome rendered. ADR-021 requires Guided Play to
 * teach as it enforces, so this pins the fix at both layers.
 */

import { describe, expect, test, afterEach } from 'bun:test'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'

import { DashboardGauge } from '../DashboardGauge'
import type { ProvenanceLine } from '../../stat/StatProvenance'

afterEach(cleanup)

const LINES: ProvenanceLine[] = [
  { kind: 'base', label: 'Atlas chassis', detail: 'base', amount: 18 },
  { kind: 'contribution', label: 'Installed systems & modules', amount: 10 },
]

describe('DashboardGauge — provenance (ADR-021 teach-as-you-enforce)', () => {
  test('the compact instrument exposes a provenance trigger', () => {
    render(<DashboardGauge label="SP" value={20} max={28} provenance={LINES} />)
    expect(screen.getByRole('button', { name: /max sp: how this is derived/i })).toBeTruthy()
  })

  test('opening it shows the derivation', async () => {
    render(<DashboardGauge label="SP" value={20} max={28} provenance={LINES} />)
    fireEvent.click(screen.getByRole('button', { name: /how this is derived/i }))
    await waitFor(() => expect(screen.getByText('Atlas chassis')).toBeTruthy())
    expect(screen.getByText('Installed systems & modules')).toBeTruthy()
  })

  test('with no provenance the instrument renders no trigger', () => {
    render(<DashboardGauge label="SP" value={20} max={28} />)
    expect(screen.queryByRole('button', { name: /how this is derived/i })).toBeNull()
  })

  test('derivedMax must differ from max to read as overridden', () => {
    // Regression: passing `max` here silently never flags — the gauge treats
    // overriddenFrom === max as "not overridden".
    render(<DashboardGauge label="SP" value={20} max={28} provenance={LINES} derivedMax={28} />)
    expect(screen.getByText('ⓘ')).toBeTruthy()
    cleanup()
    render(<DashboardGauge label="SP" value={20} max={28} provenance={LINES} derivedMax={22} />)
    expect(screen.getByText('*')).toBeTruthy()
  })
})
