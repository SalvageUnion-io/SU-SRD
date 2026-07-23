/**
 * ASIDE LEAD is OPT-IN. An artwork card whose trailing section is a section of
 * its own — the class pages' ability trees — drops the float so the section
 * spans the full width beneath the illustration instead of wrapping it.
 *
 * The gate is an explicit `asideLead` prop, deliberately NOT inferred from
 * `afterExtraContent` being present. That slot is generic: a pattern's
 * Systems/Modules loadout fills it too, and a pattern card renders with the
 * CHASSIS as its `data`, so it inherits the chassis artwork. An inferred gate
 * therefore caught every ITUN mech-wizard pattern card on an artwork-bearing
 * chassis and pushed its loadout beneath the image — a class-page layout
 * applied to a surface that never asked for it. These tests pin both halves.
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

  test('a PATTERN card with a trailing section keeps the float', () => {
    // The regression this gate narrows: a pattern card's `data` IS the chassis,
    // so it inherits the chassis artwork, and its loadout fills the same generic
    // slot. It must not be dragged into the class-page layout.
    const chassis = mule()
    const pattern = visiblePatterns(chassis.patterns ?? [])[0]
    if (!pattern) throw new Error('Mule pattern fixture missing')

    const { container } = render(
      <ReferenceEntityCard
        data={chassis}
        pattern={pattern}
        size="medium"
        afterExtraContent={trailing}
      />
    )
    expect(container.innerHTML).toContain(FLOAT)
  })

  test('an artwork card with no trailing section keeps the float', () => {
    const { container } = render(<ReferenceEntityCard data={mule()} />)
    expect(container.innerHTML).toContain(FLOAT)
  })
})
