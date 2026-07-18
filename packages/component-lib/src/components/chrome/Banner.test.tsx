/**
 * Unit tests for Banner (the advisory soft-warning strip).
 *
 * Tests that:
 * - Renders nothing when warnings array is empty
 * - Renders each warning message when non-empty
 * - Renders "Save anyway" and "Fix it" buttons when actions are provided
 * - Clicking "Save anyway" calls onSaveAnyway; "Fix it" calls onFixIt
 * - severity-based icon is rendered per warning
 * - role=alert + optional className
 */

import '@testing-library/jest-dom'
import { afterEach, describe, expect, mock, test } from 'bun:test'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'

import { Banner, type BannerWarning } from './Banner'

afterEach(cleanup)

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
    const { container } = render(
      <Banner warnings={[]} onSaveAnyway={() => {}} onFixIt={() => {}} />
    )
    expect(container.firstChild).toBeNull()
  })

  test('renders warning message when warnings is non-empty', () => {
    render(<Banner warnings={[warnWarning]} onSaveAnyway={() => {}} onFixIt={() => {}} />)
    expect(screen.getByText(warnWarning.message)).toBeTruthy()
  })

  test('renders multiple warnings', () => {
    render(
      <Banner warnings={[warnWarning, infoWarning]} onSaveAnyway={() => {}} onFixIt={() => {}} />
    )
    expect(screen.getByText(warnWarning.message)).toBeTruthy()
    expect(screen.getByText(infoWarning.message)).toBeTruthy()
  })

  test('renders "Save anyway" and "Fix it" buttons when actions are provided', () => {
    render(<Banner warnings={[warnWarning]} onSaveAnyway={() => {}} onFixIt={() => {}} />)
    expect(screen.getByRole('button', { name: /save anyway/i })).toBeTruthy()
    expect(screen.getByRole('button', { name: /fix it/i })).toBeTruthy()
  })

  test('clicking "Save anyway" calls onSaveAnyway', async () => {
    const onSaveAnyway = mock(() => {})
    const onFixIt = mock(() => {})
    render(<Banner warnings={[warnWarning]} onSaveAnyway={onSaveAnyway} onFixIt={onFixIt} />)

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /save anyway/i }))
    })

    expect(onSaveAnyway).toHaveBeenCalledTimes(1)
    expect(onFixIt).not.toHaveBeenCalled()
  })

  test('clicking "Fix it" calls onFixIt', async () => {
    const onSaveAnyway = mock(() => {})
    const onFixIt = mock(() => {})
    render(<Banner warnings={[warnWarning]} onSaveAnyway={onSaveAnyway} onFixIt={onFixIt} />)

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /fix it/i }))
    })

    expect(onFixIt).toHaveBeenCalledTimes(1)
    expect(onSaveAnyway).not.toHaveBeenCalled()
  })

  test('warn severity renders ⚠ icon', () => {
    render(<Banner warnings={[warnWarning]} onSaveAnyway={() => {}} onFixIt={() => {}} />)
    const list = screen.getByRole('list')
    expect(list.textContent).toContain('⚠')
  })

  test('info severity renders ℹ icon', () => {
    render(<Banner warnings={[infoWarning]} onSaveAnyway={() => {}} onFixIt={() => {}} />)
    const list = screen.getByRole('list')
    expect(list.textContent).toContain('ℹ')
  })

  test('renders role=alert for accessibility', () => {
    render(<Banner warnings={[warnWarning]} onSaveAnyway={() => {}} onFixIt={() => {}} />)
    expect(screen.getByRole('alert')).toBeTruthy()
  })

  test('accepts optional className', () => {
    render(
      <Banner
        warnings={[warnWarning]}
        onSaveAnyway={() => {}}
        onFixIt={() => {}}
        className="custom-class"
      />
    )
    const alert = screen.getByRole('alert')
    expect(alert.className).toContain('custom-class')
  })

  test('passive info-only variant renders no action buttons', () => {
    render(<Banner warnings={[infoWarning]} />)
    expect(screen.queryByRole('button')).toBeNull()
  })
})
