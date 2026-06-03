import { describe, test, expect, afterEach } from 'bun:test'
import { useState } from 'react'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import type { SURefObjectChoice } from 'salvageunion-reference'
import { ChoiceGroups } from '../ChoiceGroups'
import type { ChoiceSelections } from '../choiceSelectionHelpers'

const weaponTypeChoice: SURefObjectChoice = {
  id: 'weapon-type',
  name: 'Weapon Type',
  choiceType: 'permanent',
  schema: ['traits'],
  schemaEntities: ['Ballistic', 'Energy'],
}

const modificationChoice: SURefObjectChoice = {
  id: 'modification',
  name: 'Modification',
  choiceType: 'permanent',
  multiSelect: true,
  constraints: { scalesWithField: 'techLevel' },
  choiceOptions: [
    { label: 'Rangefinder', value: 'Rangefinder', description: 'Increases Range to Far.' },
    { label: 'Laser Guidance', value: 'Laser Guidance', description: 'Spend 2 AP to hit.' },
    { label: 'High Calibre Rounds', value: 'High Calibre Rounds', description: '+1 SP damage.' },
  ],
}

const nameChoice: SURefObjectChoice = {
  id: 'name',
  name: 'Name',
  choiceType: 'freeform',
  content: [{ type: 'paragraph', value: 'The name of your companion.' }],
}

const parent = { techLevel: 2 }

afterEach(cleanup)

describe('ChoiceGroups — uncontrolled (ephemeral) state', () => {
  test('renders option cards with a Not Chosen status by default', () => {
    render(<ChoiceGroups choices={[weaponTypeChoice]} parent={parent} />)
    expect(screen.getByText('Ballistic')).toBeTruthy()
    expect(screen.getByText('Energy')).toBeTruthy()
    expect(screen.getAllByText('Not Chosen').length).toBe(2)
    expect(screen.queryByText('Chosen')).toBeNull()
  })

  test('toggles an option on click and back off', () => {
    render(<ChoiceGroups choices={[weaponTypeChoice]} parent={parent} />)
    const ballistic = screen.getByRole('button', { name: /Ballistic/ })
    fireEvent.click(ballistic)
    expect(ballistic.getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByText('Chosen')).toBeTruthy()

    fireEvent.click(ballistic)
    expect(ballistic.getAttribute('aria-pressed')).toBe('false')
    expect(screen.queryByText('Chosen')).toBeNull()
  })
})

describe('ChoiceGroups — exclusive vs multi-select', () => {
  test('exclusive choice deselects the previous option', () => {
    render(<ChoiceGroups choices={[weaponTypeChoice]} parent={parent} />)
    const ballistic = screen.getByRole('button', { name: /Ballistic/ })
    const energy = screen.getByRole('button', { name: /Energy/ })

    fireEvent.click(ballistic)
    expect(ballistic.getAttribute('aria-pressed')).toBe('true')

    fireEvent.click(energy)
    expect(energy.getAttribute('aria-pressed')).toBe('true')
    expect(ballistic.getAttribute('aria-pressed')).toBe('false')
  })

  test('multi-select choice keeps multiple options selected', () => {
    render(<ChoiceGroups choices={[modificationChoice]} parent={parent} />)
    const rangefinder = screen.getByRole('button', { name: /Rangefinder/ })
    const highCalibre = screen.getByRole('button', { name: /High Calibre Rounds/ })

    fireEvent.click(rangefinder)
    fireEvent.click(highCalibre)

    expect(rangefinder.getAttribute('aria-pressed')).toBe('true')
    expect(highCalibre.getAttribute('aria-pressed')).toBe('true')
  })
})

describe('ChoiceGroups — multi-select cap (scalesWithField)', () => {
  test('shows an (n/max) counter resolved from the parent field', () => {
    render(<ChoiceGroups choices={[modificationChoice]} parent={parent} />)
    // techLevel: 2 → cap 2, nothing selected yet.
    expect(screen.getByText('0/2')).toBeTruthy()
  })

  test('shows the cap as an informational counter but allows selecting beyond it (SRD)', () => {
    render(<ChoiceGroups choices={[modificationChoice]} parent={{ techLevel: 1 }} />)
    const rangefinder = screen.getByRole('button', { name: /Rangefinder/ })
    const laser = screen.getByRole('button', { name: /Laser Guidance/ })

    fireEvent.click(rangefinder)
    expect(rangefinder.getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByText('1/1')).toBeTruthy()

    // Cap is 1, but the SRD lets the user keep selecting — options are not disabled.
    expect((laser as HTMLButtonElement).disabled).toBe(false)
    fireEvent.click(laser)
    expect(laser.getAttribute('aria-pressed')).toBe('true')
    // The counter reflects the over-cap selection (2/1).
    expect(screen.getByText('2/1')).toBeTruthy()
  })
})

describe('ChoiceGroups — free-text choice', () => {
  test('renders an editable field and updates its value (no Chosen/Not Chosen stamp)', () => {
    render(<ChoiceGroups choices={[nameChoice]} parent={parent} />)
    const field = screen.getByLabelText('Name') as HTMLInputElement
    expect(field).toBeTruthy()
    // Free-text input cards carry no Chosen / Not Chosen status stamp.
    expect(screen.queryByText('Not Chosen')).toBeNull()
    expect(screen.queryByText('Chosen')).toBeNull()

    fireEvent.change(field, { target: { value: 'Rex' } })
    expect(field.value).toBe('Rex')
  })
})

describe('ChoiceGroups — controlled props', () => {
  test('renders selection from controlled props and reports changes', () => {
    const calls: ChoiceSelections[] = []
    render(
      <ChoiceGroups
        choices={[weaponTypeChoice]}
        parent={parent}
        selections={{ 'weapon-type': ['Ballistic'] }}
        onSelectionChange={(next) => calls.push(next)}
      />
    )
    const ballistic = screen.getByRole('button', { name: /Ballistic/ })
    const energy = screen.getByRole('button', { name: /Energy/ })
    expect(ballistic.getAttribute('aria-pressed')).toBe('true')

    fireEvent.click(energy)
    // Controlled: parent gets the next map; local DOM does not change until the
    // parent re-renders with new props.
    expect(calls.length).toBe(1)
    expect(calls[0]).toEqual({ 'weapon-type': ['Energy'] })
    expect(ballistic.getAttribute('aria-pressed')).toBe('true')
  })

  test('controlled parent owning state drives the displayed selection', () => {
    function Harness() {
      const [selections, setSelections] = useState<ChoiceSelections>({})
      return (
        <ChoiceGroups
          choices={[weaponTypeChoice]}
          parent={parent}
          selections={selections}
          onSelectionChange={setSelections}
        />
      )
    }
    render(<Harness />)
    const ballistic = screen.getByRole('button', { name: /Ballistic/ })
    fireEvent.click(ballistic)
    expect(ballistic.getAttribute('aria-pressed')).toBe('true')
  })
})

describe('ChoiceGroups — empty', () => {
  test('renders nothing when there are no choices', () => {
    const { container } = render(<ChoiceGroups choices={[]} parent={parent} />)
    expect(container.firstChild).toBeNull()
  })
})
