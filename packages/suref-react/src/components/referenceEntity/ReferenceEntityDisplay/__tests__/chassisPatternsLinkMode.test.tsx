import { describe, test, expect, afterEach, mock } from 'bun:test'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import { SalvageUnionReference } from 'salvageunion-reference'
import type { SURefChassis, SURefEntity } from 'salvageunion-reference'
import { ReferenceEntityChassisPatterns } from '../ReferenceEntityChassisPatterns'
import { EntityHrefProvider, EntityDetailLinkProvider } from '../entityHrefContext'

/**
 * Regression: a pattern under a chassis is a modal-only configured view of the
 * chassis (per-pattern title/stats/loadout) with no standalone URL. Even when
 * the consuming app enables link mode (suref-web wraps entities in
 * `EntityDetailLinkProvider value={true}`), clicking a pattern must open the
 * in-place detail modal — NOT `window.open` the chassis's own show page (which
 * would drop the pattern-specific view and read as "nothing happened / blink").
 *
 * The provider that forces link mode off must wrap the component whose
 * `useDetailModal` hook reads the context; placing it inside that component's
 * returned JSX (covering only its children) leaves the hook reading the ambient
 * `true`, which is the bug this pins.
 */
const mule = SalvageUnionReference.Chassis.find((c) => c.name === 'Mule') as SURefChassis

afterEach(() => cleanup())

describe('ReferenceEntityChassisPatterns — link-mode detail', () => {
  test('fixture has patterns', () => {
    expect(mule).toBeDefined()
    expect(mule.patterns.length).toBeGreaterThan(0)
  })

  test('clicking a pattern in link mode opens the modal, not a new tab', () => {
    const openSpy = mock(() => null)
    const originalOpen = window.open
    window.open = openSpy as unknown as typeof window.open

    try {
      render(
        <EntityHrefProvider value={(e) => `/schema/chassis/item/${e.id}`}>
          <EntityDetailLinkProvider value={true}>
            <ReferenceEntityChassisPatterns
              patterns={mule.patterns}
              chassisEntity={mule as SURefEntity}
            />
          </EntityDetailLinkProvider>
        </EntityHrefProvider>
      )

      const card = document.querySelector('[role="button"]') as HTMLElement | null
      expect(card).toBeTruthy()
      fireEvent.click(card as HTMLElement)

      // The regression: pre-fix this click called window.open (link-out) and
      // rendered no modal.
      expect(openSpy).not.toHaveBeenCalled()
      expect(screen.queryByRole('dialog')).toBeTruthy()
    } finally {
      window.open = originalOpen
    }
  })
})
