/**
 * QuickRollFab tests (design review R-6/U-3).
 *
 * The d20 is injected via the `roll` prop so every test is deterministic.
 * Rolls are component state only — nothing here touches a store; the mech
 * Push path is exercised through the injected `onPush` callback (the caller
 * owns the +2 Heat + Heat Check bookkeeping per ADR-007).
 */

import { afterEach, describe, expect, mock, test } from 'bun:test'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'

import { QuickRollFab } from '../QuickRollFab'
import type { Roll } from '../../../lib/rules/heatCheck'

afterEach(() => {
  cleanup()
})

/** Returns a Roll that yields the given values in order, ignoring `sides`. */
function seqRoll(...values: number[]): Roll {
  let i = 0
  return () => {
    const v = values[i] ?? values[values.length - 1] ?? 1
    i++
    return v
  }
}

describe('QuickRollFab — rolling', () => {
  test('FAB tap rolls the d20 and shows the band readout', () => {
    render(<QuickRollFab roll={seqRoll(20)} />)

    fireEvent.click(screen.getByRole('button', { name: /roll d20/i }))

    // The latest readout (a polite live region) carries the die + the band.
    const status = screen.getByRole('status')
    expect(status.textContent).toContain('20')
    expect(screen.getByText('Nailed It')).toBeTruthy()
  })

  test('a 1 reads as Cascade Failure, colored by the cascade token', () => {
    render(<QuickRollFab roll={seqRoll(1)} />)

    fireEvent.click(screen.getByRole('button', { name: /roll d20/i }))

    const chip = screen.getByText('Cascade Failure')
    expect(chip.getAttribute('data-band')).toBe('cascade')
    expect(chip.className).toContain('bg-roll-cascade')
  })

  test('repeat rolls accumulate in the recent-rolls list (newest first)', () => {
    render(<QuickRollFab roll={seqRoll(15, 7)} />)

    const fab = screen.getByRole('button', { name: /roll d20/i })
    fireEvent.click(fab)
    fireEvent.click(fab)

    // Latest = 7 (Tough Choice); 15 moved into the history list.
    expect(screen.getByText('Tough Choice')).toBeTruthy()
    const history = screen.getByRole('list', { name: /recent rolls/i })
    expect(history.textContent).toContain('15')
    expect(history.textContent).toContain('Success')
  })

  test('close button dismisses the panel; results stay component-state only', () => {
    render(<QuickRollFab roll={seqRoll(12)} />)

    fireEvent.click(screen.getByRole('button', { name: /roll d20/i }))
    fireEvent.click(screen.getByRole('button', { name: /close roll results/i }))

    expect(screen.queryByText('Success')).toBeNull()
  })

  test('Escape dismisses the panel', () => {
    render(<QuickRollFab roll={seqRoll(12)} />)

    fireEvent.click(screen.getByRole('button', { name: /roll d20/i }))
    fireEvent.keyDown(document, { key: 'Escape' })

    expect(screen.queryByText('Success')).toBeNull()
  })
})

describe('QuickRollFab — Push affordance (mech sheets)', () => {
  test('no onPush → no Push button', () => {
    render(<QuickRollFab roll={seqRoll(12)} />)

    fireEvent.click(screen.getByRole('button', { name: /roll d20/i }))

    expect(screen.queryByRole('button', { name: /push/i })).toBeNull()
  })

  test('Push calls onPush, re-rolls, and surfaces the heat-check outcome', async () => {
    const onPush = mock(async () => '+2 Heat → 6. Heat Check 18 vs Heat 6 — passed (no overload).')
    // First roll = 4 (Failure), push re-roll = 17 (Success).
    render(<QuickRollFab roll={seqRoll(4, 17)} onPush={onPush} />)

    fireEvent.click(screen.getByRole('button', { name: /roll d20/i }))
    expect(screen.getByText('Failure')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: /push \(\+2 heat\)/i }))

    await waitFor(() => {
      expect(screen.getByText('17')).toBeTruthy()
    })
    expect(onPush).toHaveBeenCalledTimes(1)
    expect(screen.getByText('Success')).toBeTruthy()
    expect(screen.getByText(/passed \(no overload\)/i)).toBeTruthy()
    // A pushed result cannot be pushed again (one re-roll per roll).
    expect(screen.queryByRole('button', { name: /push \(\+2 heat\)/i })).toBeNull()
  })
})
