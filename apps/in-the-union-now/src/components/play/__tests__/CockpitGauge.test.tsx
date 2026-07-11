/**
 * Unit tests for CockpitGauge — the bespoke dark instrument bar.
 */

import { describe, expect, test } from 'bun:test'
import { render } from '@testing-library/react'

import { CockpitGauge } from '../CockpitGauge'

describe('CockpitGauge', () => {
  test('renders max segments, fills up to value, shows value/max', () => {
    const { container, getByText } = render(<CockpitGauge label="Heat" value={4} max={6} />)
    expect(container.querySelectorAll('.pc-seg').length).toBe(6)
    expect(container.querySelectorAll('.pc-seg.on').length).toBe(4)
    expect(getByText('4/6')).toBeTruthy()
  })

  test('filled segments at/after the danger index read as danger (redline)', () => {
    const { container } = render(<CockpitGauge label="Heat" value={6} max={6} danger={4} />)
    expect(container.querySelectorAll('.pc-seg.danger').length).toBe(2)
  })

  test('over-capacity values render extra segments honestly', () => {
    const { container } = render(<CockpitGauge label="SP" value={8} max={6} />)
    expect(container.querySelectorAll('.pc-seg').length).toBe(8)
    expect(container.querySelectorAll('.pc-seg.on').length).toBe(8)
  })
})
