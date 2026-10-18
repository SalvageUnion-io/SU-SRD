/**
 * WizShell render tests: a wizard step is its title and its content (N6) —
 * the number chip and h1 over an untitled frame, no head band around the
 * step's entities.
 */

import { describe, expect, test } from 'bun:test'
import { render, screen } from '@testing-library/react'
import { WizShell } from '../WizShell'

function renderStep() {
  return render(
    <WizShell
      kind="mech"
      eyebrow="New Mech"
      steps={['Gain Scrap', 'Chassis', 'Review']}
      active={1}
      title="Choose your Chassis"
      onCancel={() => {}}
      onNext={() => {}}
      submitLabel="Create Mech"
    >
      <p>Step content</p>
    </WizShell>
  )
}

describe('WizShell', () => {
  test("the step's title is the page's h1, read with its place in the steps", () => {
    renderStep()
    const h1 = screen.getByRole('heading', { level: 1 })
    expect(h1.textContent).toBe('Step 2 of 3 · Choose your Chassis')
    expect(h1.closest('article')).toBeTruthy()
  })

  test('the number chip sits beside the title, hidden from a screen reader', () => {
    const { container } = renderStep()
    const h1 = screen.getByRole('heading', { level: 1 })
    const chip = h1.previousElementSibling
    expect(chip?.textContent).toBe('2')
    expect(chip?.getAttribute('aria-hidden')).toBe('true')
    expect(container.querySelector('article')?.contains(chip ?? null)).toBe(true)
  })

  test('the content sits in an untitled frame: no head band wraps it', () => {
    const { container } = renderStep()
    const content = screen.getByText('Step content')
    const frame = content.closest('.su-box')
    expect(frame).toBeTruthy()
    expect(frame?.querySelector('.su-entity-row__head')).toBeNull()
    expect(container.querySelector('.su-entity-row__head')).toBeNull()
  })
})
