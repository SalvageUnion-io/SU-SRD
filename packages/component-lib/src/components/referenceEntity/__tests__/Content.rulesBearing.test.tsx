/**
 * The inline rules-bearing marker (C4, ADR-029).
 *
 * Marks the clause the app actually applies, adjacent to the claim itself —
 * extending ADR-026 §5's rust "modified" language from stat cells to a prose
 * span.
 *
 * The negative case carries the design intent: prose that STATES a mechanical
 * change on a record with NO structured data stays UNMARKED, so a coverage gap
 * is visible in the product and not only in CI.
 */

import { describe, expect, test } from 'bun:test'
import { render } from '@testing-library/react'
import { Content } from '../Content'

const claim = [
  { type: 'paragraph' as const, value: "This System increases your Mech's Max SP by 5." },
]
const flavour = [{ type: 'paragraph' as const, value: 'Layered plates of resilient metal.' }]

function marks(container: HTMLElement): number {
  return container.querySelectorAll('[data-rules-bearing="true"]').length
}

describe('rules-bearing prose marker', () => {
  test('marks a paragraph that states a mechanical change on an ENCODED record', () => {
    const { container } = render(<Content body={claim} rulesBearing />)
    expect(marks(container)).toBe(1)
  })

  test('leaves the SAME claim unmarked when the record carries no data', () => {
    // The visible coverage gap: the app is not applying this, and says so by
    // saying nothing.
    const { container } = render(<Content body={claim} rulesBearing={false} />)
    expect(marks(container)).toBe(0)
  })

  test('does not mark flavour text on an encoded record', () => {
    const { container } = render(<Content body={flavour} rulesBearing />)
    expect(marks(container)).toBe(0)
  })

  test('marks only the claiming paragraph, not its neighbours', () => {
    const { container } = render(<Content body={[...flavour, ...claim, ...flavour]} rulesBearing />)
    expect(marks(container)).toBe(1)
  })

  test('defaults to unmarked when the prop is omitted', () => {
    const { container } = render(<Content body={claim} />)
    expect(marks(container)).toBe(0)
  })
})
