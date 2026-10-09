/**
 * Phase 1B — the unified edit-language control chrome (clean-edit.html).
 *
 *   - HButton: the container-header control button (`.hbtn`) with edit / done /
 *     add variants.
 *   - the section header row: a solid `Slab` (stamp label + leader rule +
 *     trailing controls) — the shape the sheets' field/collection sections use.
 *   - SectionManageButton: rebuilt on HButton — icon + label,
 *     stable accessible names.
 */

import { describe, expect, mock, test } from 'bun:test'
import { fireEvent, render, screen } from '@testing-library/react'
import { Slab } from 'component-lib'
import { HButton, SectionManageButton } from '../SheetSection'

describe('HButton', () => {
  test('renders as a button with the design chrome and keeps the tap floor', () => {
    render(<HButton>Edit</HButton>)
    const btn = screen.getByRole('button', { name: 'Edit' })
    expect(btn.getAttribute('type')).toBe('button')
    // 44px coarse-pointer floor collapsing to the 32px design height at sm.
    expect(btn.className).toContain('min-h-11')
    expect(btn.className).toContain('sm:min-h-8')
    expect(btn.className).toContain('print:hidden')
  })

  test('done variant fills with the sheet deep tone', () => {
    render(<HButton variant="done">Done</HButton>)
    const btn = screen.getByRole('button', { name: 'Done' })
    expect(btn.className).toContain('bg-[color:var(--tone-deep,var(--color-rust))]')
    expect(btn.className).toContain('text-paper')
  })

  test('add variant is a deep-tone outline', () => {
    render(<HButton variant="add">Add</HButton>)
    const btn = screen.getByRole('button', { name: 'Add' })
    expect(btn.className).toContain('border-[color:var(--tone-deep,var(--color-rust))]')
    expect(btn.className).toContain('bg-paper')
  })
})

describe('section header (solid Slab)', () => {
  test('renders the stamp label and the trailing actions', () => {
    render(<Slab variant="solid" label="Identity" actions={<button type="button">Edit</button>} />)
    expect(screen.getByText('Identity')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Edit' })).toBeTruthy()
  })

  test('renders without an actions slot when none is given', () => {
    render(<Slab variant="solid" label="Bio" />)
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
    expect(btn.className).toContain('border-[color:var(--tone-deep,var(--color-rust))]')
  })

  test('fires onClick when clicked', () => {
    const onClick = mock(() => {})
    render(<SectionManageButton label="systems" onClick={onClick} />)
    fireEvent.click(screen.getByRole('button', { name: 'Manage systems' }))
    expect(onClick).toHaveBeenCalledTimes(1)
  })
})
