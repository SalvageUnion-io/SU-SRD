/**
 * The inline rules-bearing marker (C4, ADR-029 §6).
 *
 * Where the app applies the rules (the surface's `appliesRules`: ITUN), the
 * clause it applies leads with an ink AUTO stamp, adjacent to the claim
 * itself. The SRD applies nothing, so the same paragraph is plain prose there:
 * no stamp.
 *
 * The negative case carries the design intent: prose that STATES a mechanical
 * change on a record with NO structured data stays UNMARKED, so a coverage gap
 * is visible in the product and not only in CI.
 */

import { describe, expect, test } from 'bun:test'
import { render } from '@testing-library/react'
import type { ReactElement } from 'react'
import { EntitySurfaceProvider } from '../../../entity/EntitySurface'
import { Content } from '../Content'

const claim = [
  { type: 'paragraph' as const, value: "This System increases your Mech's Max SP by 5." },
]
const flavour = [{ type: 'paragraph' as const, value: 'Layered plates of resilient metal.' }]

const AUTO_NOTE = 'The app applies this rule'

/** The AUTO stamps drawn: one per marked paragraph. */
function marks(container: HTMLElement): number {
  return container.querySelectorAll(`[title="${AUTO_NOTE}"]`).length
}

/** Render inside a surface that applies the rules, as ITUN's root does. */
function inApp(ui: ReactElement) {
  return render(<EntitySurfaceProvider value={{ appliesRules: true }}>{ui}</EntitySurfaceProvider>)
}

describe('rules-bearing prose marker', () => {
  test('stamps AUTO on a paragraph that states a mechanical change on an ENCODED record', () => {
    const { container, getByTitle } = inApp(<Content body={claim} rulesBearing />)
    expect(marks(container)).toBe(1)
    const stamp = getByTitle(AUTO_NOTE)
    expect(stamp.textContent).toContain('Auto')
    // Its meaning reaches a screen reader, not only a pointer's hover.
    expect(stamp.querySelector('.su-sr-only')?.textContent).toContain('the app applies this rule')
  })

  test('prints the same claim as plain prose where the app applies nothing (the SRD)', () => {
    const { container } = render(<Content body={claim} rulesBearing />)
    expect(marks(container)).toBe(0)
    expect(container.textContent).not.toContain('Auto')
  })

  test('leaves the SAME claim unmarked when the record carries no data', () => {
    // The visible coverage gap: the app is not applying this, and says so by
    // saying nothing.
    const { container } = inApp(<Content body={claim} rulesBearing={false} />)
    expect(marks(container)).toBe(0)
  })

  test('does not mark flavour text on an encoded record', () => {
    const { container } = inApp(<Content body={flavour} rulesBearing />)
    expect(marks(container)).toBe(0)
  })

  test('marks only the claiming paragraph, not its neighbours', () => {
    const { container } = inApp(<Content body={[...flavour, ...claim, ...flavour]} rulesBearing />)
    expect(marks(container)).toBe(1)
  })

  test('defaults to unmarked when the prop is omitted', () => {
    const { container } = inApp(<Content body={claim} />)
    expect(marks(container)).toBe(0)
  })
})
