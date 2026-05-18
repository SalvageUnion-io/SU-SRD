/**
 * Unit tests for SoftWarningBanner.
 *
 * Tests that:
 * - Renders nothing when warnings array is empty
 * - Renders each warning message when non-empty
 * - Renders "Save anyway" and "Fix it" buttons when non-empty
 * - Clicking "Save anyway" calls onSaveAnyway
 * - Clicking "Fix it" calls onFixIt
 * - severity-based icon is rendered per warning
 */

import '@testing-library/jest-dom'
import { describe, expect, mock, test } from 'bun:test'
import { act, fireEvent, render, screen } from '@testing-library/react'

import { SoftWarningBanner } from '../SoftWarningBanner'
import type { SoftWarning } from '../../../lib/rules/types'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const warnWarning: SoftWarning = {
  code: 'SYSTEM_DEPENDENCY_REMOVED',
  message: '"Shield Gen" depends on "Power Core", which was removed from this mech.',
  severity: 'warn',
}

const infoWarning: SoftWarning = {
  code: 'ABILITY_LEVEL_PREREQUISITE',
  message: '"Elite Strike" is normally available at level 5. This pilot is level 3.',
  severity: 'info',
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('SoftWarningBanner', () => {
  test('renders nothing when warnings is empty', () => {
    const { container } = render(
      <SoftWarningBanner warnings={[]} onSaveAnyway={() => {}} onFixIt={() => {}} />
    )
    expect(container.firstChild).toBeNull()
  })

  test('renders warning message when warnings is non-empty', () => {
    render(
      <SoftWarningBanner warnings={[warnWarning]} onSaveAnyway={() => {}} onFixIt={() => {}} />
    )
    expect(screen.getByText(warnWarning.message)).toBeInTheDocument()
  })

  test('renders multiple warnings', () => {
    render(
      <SoftWarningBanner
        warnings={[warnWarning, infoWarning]}
        onSaveAnyway={() => {}}
        onFixIt={() => {}}
      />
    )
    expect(screen.getByText(warnWarning.message)).toBeInTheDocument()
    expect(screen.getByText(infoWarning.message)).toBeInTheDocument()
  })

  test('renders "Save anyway" and "Fix it" buttons when non-empty', () => {
    render(
      <SoftWarningBanner warnings={[warnWarning]} onSaveAnyway={() => {}} onFixIt={() => {}} />
    )
    expect(screen.getByRole('button', { name: /save anyway/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /fix it/i })).toBeInTheDocument()
  })

  test('clicking "Save anyway" calls onSaveAnyway', async () => {
    const onSaveAnyway = mock(() => {})
    const onFixIt = mock(() => {})
    render(
      <SoftWarningBanner warnings={[warnWarning]} onSaveAnyway={onSaveAnyway} onFixIt={onFixIt} />
    )

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /save anyway/i }))
    })

    expect(onSaveAnyway).toHaveBeenCalledTimes(1)
    expect(onFixIt).not.toHaveBeenCalled()
  })

  test('clicking "Fix it" calls onFixIt', async () => {
    const onSaveAnyway = mock(() => {})
    const onFixIt = mock(() => {})
    render(
      <SoftWarningBanner warnings={[warnWarning]} onSaveAnyway={onSaveAnyway} onFixIt={onFixIt} />
    )

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /fix it/i }))
    })

    expect(onFixIt).toHaveBeenCalledTimes(1)
    expect(onSaveAnyway).not.toHaveBeenCalled()
  })

  test('warn severity renders ⚠ icon', () => {
    render(
      <SoftWarningBanner warnings={[warnWarning]} onSaveAnyway={() => {}} onFixIt={() => {}} />
    )
    // The icon span has aria-hidden — query by text content directly
    const list = screen.getByRole('list')
    expect(list.textContent).toContain('⚠')
  })

  test('info severity renders ℹ icon', () => {
    render(
      <SoftWarningBanner warnings={[infoWarning]} onSaveAnyway={() => {}} onFixIt={() => {}} />
    )
    const list = screen.getByRole('list')
    expect(list.textContent).toContain('ℹ')
  })

  test('renders role=alert for accessibility', () => {
    render(
      <SoftWarningBanner warnings={[warnWarning]} onSaveAnyway={() => {}} onFixIt={() => {}} />
    )
    expect(screen.getByRole('alert')).toBeInTheDocument()
  })

  test('accepts optional className', () => {
    render(
      <SoftWarningBanner
        warnings={[warnWarning]}
        onSaveAnyway={() => {}}
        onFixIt={() => {}}
        className="custom-class"
      />
    )
    const alert = screen.getByRole('alert')
    expect(alert.className).toContain('custom-class')
  })
})
