/**
 * StatProvenance — the "how did this number get here?" panel (ADR-029).
 *
 * The assertions that matter are the access paths. A hover-only affordance is
 * unreachable by keyboard and on touch, and the max numeral is exactly the small
 * target a touch user needs this for — so click/tap AND keyboard AND hover are
 * each pinned here rather than left to a component library's defaults.
 */

import { describe, expect, test, afterEach } from 'bun:test'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'

import { StatProvenance } from './StatProvenance'
import type { ProvenanceLine } from './StatProvenance'

afterEach(cleanup)

const LINES: ProvenanceLine[] = [
  { kind: 'base', label: 'Atlas chassis', detail: 'base', amount: 18 },
  { kind: 'contribution', label: 'Composite Armour', detail: '×2 installed', amount: 10 },
  { kind: 'adjustment', label: 'Manual adjustment', amount: 2 },
]

function renderPanel(props: Partial<Parameters<typeof StatProvenance>[0]> = {}) {
  return render(
    <StatProvenance statLabel="Max SP" lines={LINES} total={30} {...props}>
      30
    </StatProvenance>
  )
}

describe('StatProvenance', () => {
  test('the trigger is a real button, labelled for screen readers', () => {
    renderPanel()
    const trigger = screen.getByRole('button', { name: /max sp: how this is derived/i })
    expect(trigger).toBeTruthy()
    expect(trigger.tagName).toBe('BUTTON')
  })

  test('opens on click — the touch/tap path', async () => {
    renderPanel()
    fireEvent.click(screen.getByRole('button'))
    await waitFor(() => expect(screen.getByText('Atlas chassis')).toBeTruthy())
  })

  test('opens on keyboard activation — Enter on the focused trigger', async () => {
    renderPanel()
    const trigger = screen.getByRole('button')
    trigger.focus()
    expect(document.activeElement).toBe(trigger)
    fireEvent.keyDown(trigger, { key: 'Enter' })
    fireEvent.click(trigger)
    await waitFor(() => expect(screen.getByText('Composite Armour')).toBeTruthy())
  })

  test('opens on hover', async () => {
    renderPanel()
    fireEvent.mouseEnter(screen.getByRole('button'))
    await waitFor(() => expect(screen.getByText('Atlas chassis')).toBeTruthy())
  })

  test('renders every contribution with an explicit sign, and the total', async () => {
    renderPanel()
    fireEvent.click(screen.getByRole('button'))
    await waitFor(() => expect(screen.getByText('Atlas chassis')).toBeTruthy())
    // base renders bare; addends carry a sign
    expect(screen.getByText('18')).toBeTruthy()
    expect(screen.getByText('+10')).toBeTruthy()
    expect(screen.getByText('+2')).toBeTruthy()
    expect(screen.getByText('Showing')).toBeTruthy()
  })

  test('a negative contribution renders with a true minus, not a hyphen', async () => {
    renderPanel({
      lines: [
        { kind: 'base', label: 'Pilot', amount: 10 },
        { kind: 'contribution', label: 'Major Injury', amount: -2 },
      ],
      total: 8,
    })
    fireEvent.click(screen.getByRole('button'))
    await waitFor(() => expect(screen.getByText('Major Injury')).toBeTruthy())
    expect(screen.getByText('−2')).toBeTruthy()
  })

  test('an override is shown ON TOP of the derivation, never instead of it', async () => {
    renderPanel({
      lines: [
        ...LINES,
        { kind: 'derived', label: 'Derived', amount: 30 },
        { kind: 'override', label: 'Override', detail: 'pinned by hand', amount: 36 },
      ],
      total: 36,
      overridden: true,
    })
    fireEvent.click(screen.getByRole('button'))
    await waitFor(() => expect(screen.getByText('Override')).toBeTruthy())
    // the full derivation is still listed, so the revert target is explained
    expect(screen.getByText('Atlas chassis')).toBeTruthy()
    expect(screen.getByText('Derived')).toBeTruthy()
    expect(screen.getByText('36 *')).toBeTruthy()
  })
})
