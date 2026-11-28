/**
 * The mech builder's chassis step shows the chassis ability (E19): choosing a
 * chassis needs it, though every other card leaves it to the page. It stands
 * once, on the picked chassis's card beside the list, nested there as a
 * contentful Mini (N3), never a card; the legal starting patterns are rows of
 * their own list, which do not repeat it.
 */
import { describe, expect, it } from 'bun:test'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { useState } from 'react'
import { MechChassisStep } from '../MechChassisStep'

/** How many times the Mule's chassis ability prints. */
const cargoBays = (container: HTMLElement) =>
  (container.textContent ?? '').split('Integrated Cargo Bay').length - 1

const step = (chassisName: string, gameId?: string) => (
  <MechChassisStep
    gameId={gameId}
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
    expect(queryByRole('table', { name: 'Or start from a Pattern (optional)' })).toBeNull()
  })

  it('the picked chassis shows its ability once, and its patterns do not repeat it', () => {
    // The Mule's card, then its one legal starting pattern (Hauler) as a row.
    const { container, getByRole } = render(step('mule'))
    expect(cargoBays(container)).toBe(1)
    const patterns = getByRole('table', { name: 'Or start from a Pattern (optional)' })
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

  it('a dimmed pattern says why where it is pressed, and its link is the app route (r2 D5)', () => {
    const { getByRole, queryByRole } = render(step('mule'))
    // The help link is a route: the surface's link adds the app's base, once.
    expect(getByRole('link', { name: 'New Mech, From a pattern' }).getAttribute('href')).toBe(
      '/mechs/new?mode=pattern'
    )
    expect(queryByRole('status')).toBeNull()
    const patterns = getByRole('table', { name: 'Or start from a Pattern (optional)' })
    fireEvent.click(within(patterns).getByRole('radio', { name: 'Crusher' }))
    const why = getByRole('status')
    expect(why.textContent).toContain('Crusher')
    expect(why.textContent).toContain('Not a starting Pattern')
    // Its way on builds that pattern as printed: the New Mech screen, on its confirm.
    expect(within(why).getByRole('link').getAttribute('href')).toBe(
      '/mechs/new?chassis=mule&pattern=crusher'
    )
  })

  it('in a Game, both links keep the Game in the address (r3 L4)', () => {
    const { getByRole } = render(step('mule', 'game-1'))
    expect(getByRole('link', { name: 'New Mech, From a pattern' }).getAttribute('href')).toBe(
      '/mechs/new?game=game-1&mode=pattern'
    )
    const patterns = getByRole('table', { name: 'Or start from a Pattern (optional)' })
    fireEvent.click(within(patterns).getByRole('radio', { name: 'Crusher' }))
    expect(within(getByRole('status')).getByRole('link').getAttribute('href')).toBe(
      '/mechs/new?chassis=mule&pattern=crusher&game=game-1'
    )
  })
})

/** The step with its chassis pick held, as the wizard holds it. */
function Step({ start = '' }: { start?: string }) {
  const [chassis, setChassis] = useState(start)
  return (
    <MechChassisStep
      chassisName={chassis}
      patternName=""
      onSelectChassis={setChassis}
      onSelectPattern={() => {}}
      onSelectCustom={() => {}}
    />
  )
}

describe('MechChassisStep, one radio group (r7 F11)', () => {
  it('the plates are one Tab stop, and the arrows move the pick', () => {
    render(<Step />)
    const group = screen.getByRole('radiogroup', { name: 'Tech 1 Chassis' })
    const plates = [...group.querySelectorAll<HTMLElement>('[role="radio"]')]
    expect(plates.filter((plate) => plate.tabIndex === 0)).toHaveLength(1)
    expect(plates[0]?.tabIndex).toBe(0)
    fireEvent.keyDown(plates[0] as HTMLElement, { key: 'ArrowRight' })
    expect(plates[1]?.getAttribute('aria-checked')).toBe('true')
    expect(plates[1]?.tabIndex).toBe(0)
    expect(plates[0]?.tabIndex).toBe(-1)
    fireEvent.keyDown(plates[1] as HTMLElement, { key: 'ArrowLeft' })
    expect(plates[0]?.getAttribute('aria-checked')).toBe('true')
  })

  it('the pattern list says optional in its title, with no head of its own for it', () => {
    render(<Step start="mule" />)
    const list = screen.getByRole('table', { name: /Or start from a Pattern \(optional\)/ })
    expect(list.querySelector('thead')?.textContent).not.toMatch(/^Optional$|Optional$/)
  })
})
