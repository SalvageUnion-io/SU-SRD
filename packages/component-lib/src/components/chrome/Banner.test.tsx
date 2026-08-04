/**
 * Unit tests for Banner (the advisory soft-warning strip).
 *
 * Tests that:
 * - Renders nothing when warnings array is empty
 * - Renders each warning message when non-empty
 * - severity-based icon is rendered per warning
 * - role=alert + optional className
 */

import '@testing-library/jest-dom'
import { describe, expect, test } from 'bun:test'
import { render, screen } from '@testing-library/react'
import type { BannerWarning } from './Banner'
import { Banner } from './Banner'

const warnWarning: BannerWarning = {
  message: '"Shield Gen" depends on "Power Core", which was removed from this mech.',
  severity: 'warn',
}

const infoWarning: BannerWarning = {
  message: '"Elite Strike" is normally available at level 5. This pilot is level 3.',
  severity: 'info',
}

describe('Banner', () => {
  test('renders nothing when warnings is empty', () => {
    const { container } = render(<Banner warnings={[]} />)
    expect(container.firstChild).toBeNull()
  })

  test('renders warning message when warnings is non-empty', () => {
    render(<Banner warnings={[warnWarning]} />)
    expect(screen.getByText(warnWarning.message)).toBeTruthy()
  })

  test('renders multiple warnings', () => {
    render(<Banner warnings={[warnWarning, infoWarning]} />)
    expect(screen.getByText(warnWarning.message)).toBeTruthy()
    expect(screen.getByText(infoWarning.message)).toBeTruthy()
  })

  test('warn severity renders ⚠ icon', () => {
    render(<Banner warnings={[warnWarning]} />)
    const list = screen.getByRole('list')
    expect(list.textContent).toContain('⚠')
  })

  test('info severity renders ℹ icon', () => {
    render(<Banner warnings={[infoWarning]} />)
    const list = screen.getByRole('list')
    expect(list.textContent).toContain('ℹ')
  })

  test('renders role=alert for accessibility', () => {
    render(<Banner warnings={[warnWarning]} />)
    expect(screen.getByRole('alert')).toBeTruthy()
  })

  test('accepts optional className', () => {
    render(<Banner warnings={[warnWarning]} className="custom-class" />)
    const alert = screen.getByRole('alert')
    expect(alert.className).toContain('custom-class')
  })

  test('renders no action buttons — the strip is purely advisory', () => {
    render(<Banner warnings={[infoWarning]} />)
    expect(screen.queryByRole('button')).toBeNull()
  })
})
