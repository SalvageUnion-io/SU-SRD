/**
 * Phase 1B — the unified edit-language control chrome (clean-edit.html).
 *
 *   - HButton: the container-header control button (`.hbtn`) with edit / done /
 *     add variants.
 *   - the section header row: a solid `Slab` (stamp label + leader rule +
 *     trailing controls) — the shape the sheets' field/collection sections use.
 *   - SectionEditButton / SectionAddButton: rebuilt on HButton — icon + label,
 *     stable accessible names.
 *   - cardRemoveControls: the per-card ✕ (+ optional ⇄) icon-only cluster fed
 *     to DisplayCard's card-level `controls` slot.
 */

import { afterEach, describe, expect, mock, test } from 'bun:test'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { ControlButtons } from '../ControlButtons'

import { Slab } from '../../chrome/Slab'
import { HButton, SectionAddButton, SectionEditButton, cardRemoveControls } from '../SheetSection'

describe('HButton', () => {
  afterEach(cleanup)

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
  afterEach(cleanup)

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

describe('SectionEditButton', () => {
  afterEach(cleanup)

  test('at rest reads "Edit {section}", aria-pressed false, pencil affordance', () => {
    render(<SectionEditButton section="Identity" editing={false} onToggle={() => {}} />)
    const btn = screen.getByRole('button', { name: 'Edit identity' })
    expect(btn.getAttribute('aria-pressed')).toBe('false')
    // Visible label matches the accessible name's leading word (WCAG 2.5.3).
    expect(btn.textContent).toContain('Edit')
  })

  test('while editing reads "Done editing {section}", aria-pressed true', () => {
    render(<SectionEditButton section="Identity" editing onToggle={() => {}} />)
    const btn = screen.getByRole('button', { name: 'Done editing identity' })
    expect(btn.getAttribute('aria-pressed')).toBe('true')
    expect(btn.className).toContain('bg-[color:var(--tone-deep,var(--color-rust))]')
  })

  test('fires onToggle when clicked', () => {
    const onToggle = mock(() => {})
    render(<SectionEditButton section="Identity" editing={false} onToggle={onToggle} />)
    fireEvent.click(screen.getByRole('button', { name: 'Edit identity' }))
    expect(onToggle).toHaveBeenCalledTimes(1)
  })
})

describe('SectionAddButton', () => {
  afterEach(cleanup)

  test('reads "Add {noun}" with the circled-plus affordance', () => {
    render(<SectionAddButton label="ability" onClick={() => {}} />)
    const btn = screen.getByRole('button', { name: 'Add ability' })
    // Visible label carries the noun (poster: "Add ability").
    expect(btn.textContent).toContain('Add ability')
    expect(btn.className).toContain('border-[color:var(--tone-deep,var(--color-rust))]')
  })

  test('fires onClick when clicked', () => {
    const onClick = mock(() => {})
    render(<SectionAddButton label="system" onClick={onClick} />)
    fireEvent.click(screen.getByRole('button', { name: 'Add system' }))
    expect(onClick).toHaveBeenCalledTimes(1)
  })
})

describe('cardRemoveControls', () => {
  afterEach(cleanup)

  test('builds a single icon-only remove control by default', () => {
    const onRemove = mock(() => {})
    const controls = cardRemoveControls({ name: 'Charge', onRemove })
    expect(controls).toHaveLength(1)
    expect(controls[0]?.key).toBe('remove')
    expect(controls[0]?.ariaLabel).toBe('Remove Charge')
    expect(controls[0]?.label).toBeUndefined()

    render(<ControlButtons controls={controls} compact />)
    const btn = screen.getByLabelText('Remove Charge')
    // Icon-only: no visible text, square chrome.
    expect(btn.textContent).toBe('')
    fireEvent.click(btn)
    expect(onRemove).toHaveBeenCalledTimes(1)
  })

  test('prepends a swap control before remove when onSwap is given', () => {
    const controls = cardRemoveControls({
      name: 'Charge',
      onRemove: () => {},
      onSwap: () => {},
    })
    expect(controls.map((c) => c.key)).toEqual(['swap', 'remove'])
    expect(controls[0]?.ariaLabel).toBe('Swap Charge')
  })
})
