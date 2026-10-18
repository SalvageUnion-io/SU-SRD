/**
 * The unified edit-language control chrome (clean-edit.html).
 *
 *   - HButton: the container-header control button (`.hbtn`), a deep-tone
 *     outline.
 *   - the section header row: a solid `Slab` (stamp label + leader rule +
 *     trailing controls) — the shape the sheets' field/collection sections use.
 *   - SectionManageButton: rebuilt on HButton — icon + label,
 *     stable accessible names.
 */

import { describe, expect, mock, test } from 'bun:test'
import { fireEvent, render, screen } from '@testing-library/react'
import { Slab } from '../../../components/index'
import { SectionManageButton } from '../SheetSection'

describe('HButton', () => {
  test('renders as a button with the design chrome and keeps the tap floor', () => {
    render(<SectionManageButton label="Abilities" onClick={() => {}} />)
    const btn = screen.getByRole('button', { name: 'Manage abilities' })
    expect(btn.getAttribute('type')).toBe('button')
    // The 44px coarse-pointer floor collapsing to the 32px design height at
    // sm, the deep-tone outline filling on hover, and the print hide, are
    // `.su-sheet-hbtn` (styles/sheet/chrome.css).
    expect(btn.className).toContain('su-sheet-hbtn')
    expect(btn.style.borderWidth).toBe('2px')
  })
})

describe('section header (solid Slab)', () => {
  test('renders the stamp label and the trailing actions', () => {
    render(<Slab label="Identity" actions={<button type="button">Edit</button>} />)
    expect(screen.getByText('Identity')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Edit' })).toBeTruthy()
  })

  test('renders without an actions slot when none is given', () => {
    render(<Slab label="Bio" />)
    expect(screen.getByText('Bio')).toBeTruthy()
    expect(screen.queryByRole('button')).toBeNull()
  })
})

describe('SectionManageButton', () => {
  test('reads "Manage {noun}" with the circled affordance', () => {
    render(<SectionManageButton label="abilities" onClick={() => {}} />)
    const btn = screen.getByRole('button', { name: 'Manage abilities' })
    // The button opens the picker, which both adds AND removes — "Add" undersold
    // it once the per-card ✕ was retired in favour of that one surface.
    expect(btn.textContent).toContain('Manage abilities')
    expect(btn.className).toContain('su-sheet-hbtn')
  })

  test('fires onClick when clicked', () => {
    const onClick = mock(() => {})
    render(<SectionManageButton label="systems" onClick={onClick} />)
    fireEvent.click(screen.getByRole('button', { name: 'Manage systems' }))
    expect(onClick).toHaveBeenCalledTimes(1)
  })
})
