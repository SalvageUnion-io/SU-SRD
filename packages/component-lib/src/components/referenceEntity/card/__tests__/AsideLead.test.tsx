/**
 * ASIDE LEAD. An artwork card whose trailing content is a section of its own —
 * the class pages' ability trees, a pattern's loadout — drops the float so that
 * section spans the full width beneath the illustration instead of wrapping it.
 *
 * TWO WAYS IN, and the difference is the point:
 *
 * - An explicit `asideLead` prop, for a consumer filling the generic
 *   `afterExtraContent` slot. Still deliberately NOT inferred from that slot
 *   being filled: the slot says nothing about what the card IS, so inferring
 *   would sweep in cards that never asked for the layout.
 * - A PATTERN card, on its own identity. Its body is chassis artwork + chassis
 *   prose, then the pattern proper — its flavour and the Systems/Modules it
 *   installs — which reads as a section, so it belongs below the fold.
 *
 * The second case reverses an earlier ruling that patterns must keep the float.
 * That ruling was about not being caught ACCIDENTALLY by the generic-slot gate
 * (a pattern card's `data` IS the chassis, so it inherits chassis artwork and
 * used to fill `afterExtraContent` with its loadout). The loadout now renders
 * inline as shortform badges, and the layout is chosen rather than inherited.
 */
import { beforeAll, describe, expect, test, afterEach } from 'bun:test'
import { cleanup, render } from '@testing-library/react'
import { SalvageUnionReference, visiblePatterns } from 'salvageunion-reference'
import { ReferenceEntityCard } from '../ReferenceEntityCard'

/** The float layout emits this class on the artwork; the aside layout drops it. */
const FLOAT = 'md:float-left'

/** The Engineer — a class with artwork and ability trees. */
const engineer = () => {
  const found = SalvageUnionReference.Classes.all().find((c) => c.name === 'Engineer')
  if (!found) throw new Error('Engineer fixture missing')
  return found
}

/** The Mule — an artwork-bearing chassis carrying patterns with loadouts. */
const mule = () => {
  const found = SalvageUnionReference.Chassis.all().find((c) => c.name === 'Mule')
  if (!found) throw new Error('Mule fixture missing')
  return found
}

/** Stands in for any trailing section (an ability tree, a loadout grid). */
const trailing = <div data-testid="trailing">trailing section</div>

afterEach(cleanup)

describe('aside lead is opt-in', () => {
  beforeAll(async () => {
    await SalvageUnionReference.preload('all')
  })

  test('a class card that opts in drops the float', () => {
    const { container } = render(
      <ReferenceEntityCard data={engineer()} afterExtraContent={trailing} asideLead />
    )
    expect(container.innerHTML).not.toContain(FLOAT)
    // The section still renders — it moved, it did not disappear.
    expect(container.querySelector('[data-testid="trailing"]')).toBeTruthy()
  })

  test('the same card WITHOUT opting in keeps the float', () => {
    const { container } = render(
      <ReferenceEntityCard data={engineer()} afterExtraContent={trailing} />
    )
    expect(container.innerHTML).toContain(FLOAT)
  })

  test('a PATTERN card on an artwork chassis drops the float', () => {
    // A pattern takes the lead layout on its own identity — no `asideLead` prop
    // and no trailing slot needed. Its pattern prose and loadout are a section,
    // and sit at full width below the artwork + chassis prose lead row.
    const chassis = mule()
    const pattern = visiblePatterns(chassis.patterns ?? [])[0]
    if (!pattern) throw new Error('Mule pattern fixture missing')

    const { container } = render(
      <ReferenceEntityCard data={chassis} pattern={pattern} size="medium" />
    )
    expect(container.innerHTML).not.toContain(FLOAT)
    // The loadout still renders — it moved, it did not disappear.
    expect(container.textContent).toContain('Systems')
  })

  test('the BASIC chassis card keeps the float', () => {
    // Only the PATTERN view takes the lead layout. The chassis card itself
    // still wraps its pattern list around the illustration, so the reversal
    // stays scoped to the one view that asked for it.
    const { container } = render(<ReferenceEntityCard data={mule()} size="medium" />)
    expect(container.innerHTML).toContain(FLOAT)
  })

  test('an artwork card with no trailing section keeps the float', () => {
    const { container } = render(<ReferenceEntityCard data={mule()} />)
    expect(container.innerHTML).toContain(FLOAT)
  })
})
