/**
 * The SRD's card surface raises a roll on a card's table as a toast — the die,
 * where it landed, and the outcome — rather than reading it out in the card.
 */

import { describe, expect, test } from 'bun:test'
import { fireEvent, render, screen } from '@testing-library/react'
import { SalvageUnionReference } from 'salvageunion-reference'
import { ReferenceEntityIsland } from '../islands/ReferenceEntityIsland'

describe('ReferenceSurface', () => {
  test("a roll on a card's table is raised as a toast, not read out in the card", async () => {
    const autoTurret = SalvageUnionReference.Abilities.getByName('Auto-Turret')
    if (!autoTurret) throw new Error('fixture missing: Auto-Turret')
    render(<ReferenceEntityIsland item={autoTurret} />)

    fireEvent.click(
      await screen.findByRole('button', { name: 'Roll the die on A.I. Personality Table' })
    )

    const title = await screen.findByText(
      /^A\.I\. Personality Table: rolled (\d+) \((\d+(?:-\d+)?)\)$/
    )
    const toast = title.closest('[data-sonner-toast]')
    expect(toast).not.toBeNull()
    // The outcome follows as the toast's description.
    expect(toast?.querySelector('[data-description]')?.textContent?.length ?? 0).toBeGreaterThan(0)
    // The card keeps no readout of its own.
    expect(screen.queryByText(/You rolled · lands on/)).toBeNull()
  })
})
