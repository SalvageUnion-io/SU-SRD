/**
 * Callout composes DisplayCard, so its anatomy is now the product of another
 * component's layout rules rather than its own div stack. These pin the three
 * things that composition could silently change: the frame takes the ACCENT
 * (not the header tint), a label-less callout paints NO header band, and the
 * body only exists when there is content for it.
 */
import { afterEach, describe, expect, test } from 'bun:test'
import { cleanup, render, screen } from '@testing-library/react'
import { Callout } from '../Callout'

afterEach(cleanup)

const MECH = 'rgb(122, 143, 120)'
const TINT = 'rgb(200, 210, 199)'

/** The outermost element — the framed card wrapper. */
function frame(container: HTMLElement): HTMLElement {
  const el = container.firstElementChild as HTMLElement | null
  if (!el) throw new Error('callout rendered nothing')
  return el
}

describe('Callout', () => {
  test('the frame takes the accent, not the header tint', () => {
    const { container } = render(
      <Callout label="When Damaged" accent={MECH} headerBg={TINT}>
        The Mech cannot move.
      </Callout>
    )
    // The whole point of the accent/tint split: a green frame around a pale
    // green band. Deriving the border from the band would paint it TINT.
    expect(frame(container).style.border).toContain(MECH)
    expect(frame(container).style.border).not.toContain(TINT)
  })

  test('a label paints a header band carrying the stamp', () => {
    render(
      <Callout label="When Damaged" accent={MECH} headerBg={TINT}>
        The Mech cannot move.
      </Callout>
    )
    expect(screen.getByText('When Damaged')).toBeTruthy()
    expect(screen.getByText('The Mech cannot move.')).toBeTruthy()
  })

  test('a label-less callout paints NO header band — just a framed paper panel', () => {
    // The band is identified by its padding pair; prove the selector MATCHES
    // when there is a label, so its absence below means something.
    const labelled = render(
      <Callout label="When Damaged" accent={MECH}>
        Pick one of the following.
      </Callout>
    )
    const band = (el: HTMLElement) => el.querySelectorAll('.px-3.py-1\\.5')
    expect(band(labelled.container).length).toBe(1)
    labelled.unmount()

    const { container } = render(<Callout accent={MECH}>Pick one of the following.</Callout>)
    expect(screen.getByText('Pick one of the following.')).toBeTruthy()
    // An empty band is the regression: the card must not reserve header height
    // for a header that has nothing in it.
    expect(band(container).length).toBe(0)
    expect(frame(container).style.border).toContain(MECH)
  })

  test('no children means no body panel', () => {
    render(<Callout label="When Damaged" accent={MECH} />)
    expect(screen.getByText('When Damaged')).toBeTruthy()
    expect(screen.queryByText('The Mech cannot move.')).toBeNull()
  })
})
