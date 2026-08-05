/**
 * P3.3 — the in-wizard "off-rules build? → Live Sheet" escape. Covers the
 * OffRulesEscape control and the WizShell footer slot it mounts into.
 */

import { describe, expect, mock, test } from 'bun:test'
import { fireEvent, render, screen } from '@testing-library/react'
import { OffRulesEscape, WizShell } from 'component-lib'

describe('OffRulesEscape', () => {
  test('renders the escape and fires onEscape on click', () => {
    const onEscape = mock(() => {})
    render(<OffRulesEscape onEscape={onEscape} />)
    fireEvent.click(screen.getByRole('button', { name: /off-rules build.*live sheet/i }))
    expect(onEscape).toHaveBeenCalledTimes(1)
  })
})

describe('WizShell — escapeAction slot', () => {
  test('renders the escapeAction node inside the action pill', () => {
    render(
      <WizShell
        kind="pilot"
        eyebrow="Pilot Bay"
        steps={['One', 'Two']}
        active={0}
        title="Step One"
        onCancel={() => {}}
        onNext={() => {}}
        submitLabel="Create Pilot"
        escapeAction={<OffRulesEscape onEscape={() => {}} />}
      >
        <div>body</div>
      </WizShell>
    )
    expect(screen.getByRole('button', { name: /off-rules build.*live sheet/i })).toBeTruthy()
  })

  test('omitting escapeAction renders no escape control', () => {
    render(
      <WizShell
        kind="pilot"
        eyebrow="Pilot Bay"
        steps={['One', 'Two']}
        active={0}
        title="Step One"
        onCancel={() => {}}
        onNext={() => {}}
        submitLabel="Create Pilot"
      >
        <div>body</div>
      </WizShell>
    )
    expect(screen.queryByRole('button', { name: /off-rules build/i })).toBeNull()
  })
})
