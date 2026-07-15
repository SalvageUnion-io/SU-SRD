/**
 * Phase 1B — the unified edit-language control chrome (clean-edit.html).
 *
 *   - HBtn: the container-header control button (`.hbtn`) with edit / done /
 *     add variants.
 *   - SectionChead: the field/collection header row (stamp title + ml-auto
 *     controls) that Phase 2 lifts into SheetSectionCard.
 *   - SectionEditButton / SectionAddButton: rebuilt on HBtn — icon + label,
 *     stable accessible names.
 *   - cardRemoveControls: the per-card ✕ (+ optional ⇄) icon-only cluster fed
 *     to DisplayCard's card-level `controls` slot.
 */

import { afterEach, describe, expect, mock, test } from 'bun:test'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { ControlButtons } from 'suref-react'

import {
  HBtn,
  SectionAddButton,
  SectionChead,
  SectionEditButton,
  cardRemoveControls,
} from '../SheetSection'

describe('HBtn', () => {
  afterEach(cleanup)

  test('renders as a button with the design chrome and keeps the tap floor', () => {
    render(<HBtn>Edit</HBtn>)
    const btn = screen.getByRole('button', { name: 'Edit' })
    expect(btn.getAttribute('type')).toBe('button')
    // 44px coarse-pointer floor collapsing to the 32px design height at sm.
    expect(btn.className).toContain('min-h-11')
    expect(btn.className).toContain('sm:min-h-8')
    expect(btn.className).toContain('print:hidden')
  })

  test('done variant fills with the sheet deep tone', () => {
    render(<HBtn variant="done">Done</HBtn>)
    const btn = screen.getByRole('button', { name: 'Done' })
    expect(btn.className).toContain('bg-[color:var(--tone-deep,var(--color-rust))]')
    expect(btn.className).toContain('text-paper')
  })

  test('add variant is a deep-tone outline', () => {
    render(<HBtn variant="add">Add</HBtn>)
    const btn = screen.getByRole('button', { name: 'Add' })
    expect(btn.className).toContain('border-[color:var(--tone-deep,var(--color-rust))]')
    expect(btn.className).toContain('bg-paper')
  })
})

describe('SectionChead', () => {
  afterEach(cleanup)

  test('renders the stamp title and pins actions to the right group', () => {
    render(<SectionChead title="Identity" actions={<button type="button">Edit</button>} />)
    expect(screen.getByText('Identity')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Edit' })).toBeTruthy()
  })

  test('omits the right group when no actions are given', () => {
    const { container } = render(<SectionChead title="Bio" />)
    expect(screen.getByText('Bio')).toBeTruthy()
    expect(container.querySelector('.ml-auto')).toBeNull()
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
