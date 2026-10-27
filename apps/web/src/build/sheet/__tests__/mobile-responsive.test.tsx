/**
 * Mobile-responsive regression tests for sheet components.
 *
 * The top-bar Share control is a Compact button (one height per Size, R12), and a
 *       Field's edit-state readout has a 44px target (its inline `min-height`,
 *       `size.full`).
 *
 * Design choices:
 * - No 320px overflow check: happy-dom has no layout engine (scrollWidth and
 *   clientWidth are always 0), so overflow needs a browser: `bun run shot
 *   … --width phone`.
 * - Touch target: we assert the Share button is a Compact `.su-btn` at the
 *   page-top height (`.su-page-action`), and a Field's edit-state readout its
 *   inline `minHeight` (a style object). Both are the most
 *   reliable assertions in happy-dom (no computed styles).
 *
 * Conventions:
 * - toBeTruthy() not toBeInTheDocument()
 * - No mock.module()
 * - Dep-injection for entityStore and softLinkStore
 */

import { beforeAll, describe, expect, test } from 'bun:test'
import { render, screen } from '@testing-library/react'
import { hydrateStores } from '../../../components/__tests__/hydrateStores'
import {
  makeEntityLookupMock,
  makeSoftLinkStoreMock,
} from '../../../components/__tests__/mockEntityStore'
import { Field } from '../../../components/index'
import { Sheet } from '../Sheet'
import { fakeMech, fakePilot, mechToPilot } from './sheetFixtures'

beforeAll(hydrateStores)

// ---------------------------------------------------------------------------
// Touch targets ≥44px on mobile
// ---------------------------------------------------------------------------

describe('Mobile responsive — touch targets', () => {
  test("a Field's edit-state readout carries a 44px min-height", () => {
    render(<Field label="Callsign" value="Ghost" onSave={() => Promise.resolve()} />)
    // The edit state's readout is a span with role=button.
    const displayEl = screen.getByRole('button', { name: 'Edit callsign' })
    expect((displayEl as HTMLElement).style.minHeight).toBe('44px')
  })

  test('the top-bar Share control is a Compact button, its Size on every pointer (R12)', () => {
    render(
      <Sheet
        kind="pilot"
        id="pilot-1"
        entityStore={makeEntityLookupMock([fakePilot])}
        softLinkStore={makeSoftLinkStoreMock([])}
      />
    )
    // A button since the share screen was deleted — same target, same rule.
    const share = screen.getByRole('button', { name: /share this pilot/i })
    const className = (share as HTMLElement).className
    expect(className).toContain('su-btn')
    expect(className).toContain('su-page-action')
    expect(className).toContain('su-btn--compact')
  })
})

// ---------------------------------------------------------------------------
// LiveSheet shell: linked entities live in the rail, not a segment switcher
// (one entity per sheet).
// ---------------------------------------------------------------------------

describe('LiveSheet rail replaces the segment switcher', () => {
  test('no tablist renders on any sheet', () => {
    render(
      <Sheet
        kind="mech"
        id="mech-1"
        entityStore={makeEntityLookupMock([fakeMech, fakePilot])}
        softLinkStore={makeSoftLinkStoreMock([mechToPilot])}
      />
    )
    expect(screen.queryByRole('tablist')).toBeNull()
  })
})
