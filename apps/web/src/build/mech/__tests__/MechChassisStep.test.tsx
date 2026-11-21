/**
 * The mech builder's chassis step shows the chassis ability (E19): choosing a
 * chassis needs it, though every other card leaves it to the page. It stands
 * once, on the picked chassis's card beside the list, nested there as a
 * contentful Mini (N3), never a card; the legal starting patterns are rows of
 * their own list, which do not repeat it.
 */
import { describe, expect, it } from 'bun:test'
import { render } from '@testing-library/react'
import { MechChassisStep } from '../MechChassisStep'

/** How many times the Mule's chassis ability prints. */
const cargoBays = (container: HTMLElement) =>
  (container.textContent ?? '').split('Integrated Cargo Bay').length - 1

const step = (chassisName: string) => (
  <MechChassisStep
    chassisName={chassisName}
    patternName=""
    onSelectChassis={() => {}}
    onSelectPattern={() => {}}
    onSelectCustom={() => {}}
  />
)

describe('MechChassisStep', () => {
  it('with no chassis picked, the list stands alone', () => {
    const { container, queryByRole } = render(step(''))
    expect(cargoBays(container)).toBe(0)
    expect(queryByRole('table', { name: 'Or start from a Pattern' })).toBeNull()
  })

  it('the picked chassis shows its ability once, and its patterns do not repeat it', () => {
    // The Mule's card, then its one legal starting pattern (Hauler) as a row.
    const { container, getByRole } = render(step('mule'))
    expect(cargoBays(container)).toBe(1)
    const patterns = getByRole('table', { name: 'Or start from a Pattern' })
    expect(patterns.textContent).toContain('Hauler')
    expect(cargoBays(patterns)).toBe(0)
  })

  it('nests the chassis ability as a contentful Mini, never a card', () => {
    const { container } = render(step('mule'))
    const tokens = [...container.querySelectorAll('.su-entity-mini[data-contentful]')]
    const abilities = tokens.filter((token) =>
      token.querySelector('.su-entity-mini__head')?.textContent?.includes('Integrated Cargo Bay')
    )
    expect(abilities).toHaveLength(1)
    for (const token of abilities) {
      expect(token.querySelector('.su-entity-mini__body')?.textContent).toContain('The Mule')
      expect(token.textContent).not.toContain('[(CHASSIS)]')
    }
  })
})
