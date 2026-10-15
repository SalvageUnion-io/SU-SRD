/**
 * The mech builder's pick cards show the chassis ability (E19's builder
 * exception): choosing a chassis or a starting pattern needs it, though every
 * other card leaves it to the page.
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

describe('MechChassisStep pick cards', () => {
  it('the chassis pick card shows its ability once', () => {
    const { container } = render(step(''))
    expect(cargoBays(container)).toBe(1)
  })

  it('the starting-pattern pick card shows the chassis ability once too', () => {
    // The Mule's chassis card, then its one legal starting pattern (Hauler).
    const { container, getByRole } = render(step('mule'))
    expect(cargoBays(container)).toBe(2)
    const patterns = getByRole('radiogroup', { name: 'Starting pattern' })
    expect(cargoBays(patterns)).toBe(1)
  })
})
