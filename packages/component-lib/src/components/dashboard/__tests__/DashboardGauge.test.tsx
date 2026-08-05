/**
 * Unit tests for DashboardGauge — a thin wrapper over VitalGauge (single-row
 * `compact` + `instrument` surface). Segments carry `data-pip="on|off"`;
 * danger/over-capacity segments get the `bg-status-bad` fill.
 */

import { describe, expect, test } from 'bun:test'
import { render } from '@testing-library/react'
import { DashboardGauge } from '../DashboardGauge'

describe('DashboardGauge', () => {
  test('renders max segments, fills up to value, shows value/max', () => {
    const { container, getByText } = render(<DashboardGauge label="Heat" value={4} max={6} />)
    expect(container.querySelectorAll('[data-pip]').length).toBe(6)
    expect(container.querySelectorAll('[data-pip="on"]').length).toBe(4)
    expect(getByText('4/6')).toBeTruthy()
  })

  test('filled segments at/after the danger index read as danger (redline)', () => {
    const { container } = render(<DashboardGauge label="Heat" value={6} max={6} danger={4} />)
    expect(container.querySelectorAll('.bg-status-bad').length).toBe(2)
  })

  test('over-capacity values render extra segments honestly (over-cap reads red)', () => {
    const { container } = render(<DashboardGauge label="SP" value={8} max={6} />)
    expect(container.querySelectorAll('[data-pip]').length).toBe(8)
    expect(container.querySelectorAll('[data-pip="on"]').length).toBe(8)
    // The 2 segments beyond max read as over-capacity (status-bad).
    expect(container.querySelectorAll('.bg-status-bad').length).toBe(2)
  })
})
