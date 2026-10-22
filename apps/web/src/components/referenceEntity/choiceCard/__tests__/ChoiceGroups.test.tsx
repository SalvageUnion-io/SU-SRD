import { describe, expect, test } from 'bun:test'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import type { RefObjectChoice } from 'salvageunion-reference'
import { ChoiceGroups } from '../ChoiceGroups'
import type { ChoiceSelections } from '../choiceSelectionHelpers'

const weaponTypeChoice: RefObjectChoice = {
  id: 'weapon-type',
  name: 'Weapon Type',
  source: { kind: 'catalog', schema: ['traits'], entities: ['Ballistic', 'Energy'] },
}

const modificationChoice: RefObjectChoice = {
  id: 'modification',
  name: 'Modification',
  cardinality: { min: 0, max: { scalesWith: 'techLevel' } },
  source: {
    kind: 'options',
    options: [
      { label: 'Rangefinder', value: 'Rangefinder', description: 'Increases Range to Far.' },
      { label: 'Laser Guidance', value: 'Laser Guidance', description: 'Spend 2 AP to hit.' },
      { label: 'High Calibre Rounds', value: 'High Calibre Rounds', description: '+1 SP damage.' },
    ],
  },
}

const nameChoice: RefObjectChoice = {
  id: 'name',
  name: 'Name',
  content: [{ type: 'paragraph', value: 'The name of your companion.' }],
}

const parent = { techLevel: 2 }

/** Narrow a queried element to a real `<button>`, failing loudly otherwise. */
function asButton(el: HTMLElement): HTMLButtonElement {
  if (!(el instanceof HTMLButtonElement)) throw new Error('expected a <button> element')
  return el
}

/** Narrow a queried element to a real `<input>`, failing loudly otherwise. */
function asInput(el: HTMLElement): HTMLInputElement {
  if (!(el instanceof HTMLInputElement)) throw new Error('expected an <input> element')
  return el
}

describe('ChoiceGroups — uncontrolled (ephemeral) state', () => {
  test('renders option cards dimmed (unchosen) with no Chosen stamp by default', () => {
    render(<ChoiceGroups choices={[weaponTypeChoice]} parent={parent} />)
    expect(screen.getByText('Ballistic')).toBeTruthy()
    expect(screen.getByText('Energy')).toBeTruthy()
    // New style: unchosen options carry no stamp; only a chosen option gets "Chosen".
    expect(screen.queryByText(/^Chosen/)).toBeNull()
    expect(screen.getByRole('button', { name: /Ballistic/ }).getAttribute('aria-pressed')).toBe(
      'false'
    )
  })

  test('toggles an option on click and back off', () => {
    render(<ChoiceGroups choices={[weaponTypeChoice]} parent={parent} />)
    const ballistic = screen.getByRole('button', { name: /Ballistic/ })
    fireEvent.click(ballistic)
    expect(ballistic.getAttribute('aria-pressed')).toBe('true')

    fireEvent.click(ballistic)
    expect(ballistic.getAttribute('aria-pressed')).toBe('false')
  })

  // Inside a card (level 2, N1) an option is untitled: no head band, no seal;
  // on its entity's Page it is the headed option card with its "Chosen" seal.
  test('only on its Page is an option headed and sealed', () => {
    const { container } = render(<ChoiceGroups choices={[weaponTypeChoice]} parent={parent} />)
    fireEvent.click(screen.getByRole('button', { name: /Ballistic/ }))
    expect(screen.queryByText(/^Chosen/)).toBeNull()
    expect(container.querySelector('.su-entity-compact__head')).toBeNull()
    cleanup()

    const page = render(<ChoiceGroups choices={[weaponTypeChoice]} parent={parent} onPage />)
    fireEvent.click(screen.getByRole('button', { name: /Ballistic/ }))
    expect(screen.getByText(/^Chosen/)).toBeTruthy()
    expect(page.container.querySelectorAll('.su-entity-compact__head').length).toBeGreaterThan(0)
  })

  test('read-only off its Page, an option is a Slab over its text', () => {
    render(
      <ChoiceGroups
        choices={[weaponTypeChoice]}
        parent={parent}
        selections={{ [weaponTypeChoice.id]: ['Ballistic'] }}
        readOnly
      />
    )
    expect(screen.queryByRole('button')).toBeNull()
    // Level 2 is ring only (hard rule R15): the chosen option is ringed, and
    // says so to a screen reader alone, never in a visible seal.
    const chosen = screen.getByText('Chosen')
    expect(chosen.className).toBe('su-sr-only')
    expect((chosen.closest('section') as HTMLElement | null)?.style.boxShadow).toBe(
      '0 0 0 3px var(--color-ink)'
    )
    expect(screen.getAllByText('Chosen')).toHaveLength(1)
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

describe('ChoiceGroups — multi-select cap (cardinality.max.scalesWith)', () => {
  test('shows an (n/max) counter resolved from the parent field', () => {
    render(<ChoiceGroups choices={[modificationChoice]} parent={parent} />)
    // techLevel: 2 → cap 2, nothing selected yet.
    expect(screen.getByText('0/2')).toBeTruthy()
  })

  test('the cap disables unchosen options and rejects picks beyond it', () => {
    render(<ChoiceGroups choices={[modificationChoice]} parent={{ techLevel: 1 }} />)
    const rangefinder = screen.getByRole('button', { name: /Rangefinder/ })
    const laser = screen.getByRole('button', { name: /Laser Guidance/ })

    // Below the cap nothing is disabled.
    expect(asButton(laser).disabled).toBe(false)

    fireEvent.click(rangefinder)
    expect(rangefinder.getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByText('1/1')).toBeTruthy()

    // Cap is 1 (techLevel) and met: the unchosen options disable, and even a
    // forced click cannot push the selection past the cap.
    expect(asButton(laser).disabled).toBe(true)
    fireEvent.click(laser)
    expect(laser.getAttribute('aria-pressed')).toBe('false')
    expect(screen.getByText('1/1')).toBeTruthy()

    // The chosen option stays clickable — deselecting reopens the cap.
    expect(asButton(rangefinder).disabled).toBe(false)
    fireEvent.click(rangefinder)
    expect(rangefinder.getAttribute('aria-pressed')).toBe('false')
    expect(asButton(laser).disabled).toBe(false)
  })

  test('a higher-tech parent widens the cap (Modifications ≤ TL)', () => {
    render(<ChoiceGroups choices={[modificationChoice]} parent={parent} />)
    const rangefinder = screen.getByRole('button', { name: /Rangefinder/ })
    const laser = screen.getByRole('button', { name: /Laser Guidance/ })
    const highCalibre = screen.getByRole('button', { name: /High Calibre Rounds/ })

    fireEvent.click(rangefinder)
    fireEvent.click(laser)
    // techLevel: 2 → cap 2 reached; the third option disables and won't select.
    expect(screen.getByText('2/2')).toBeTruthy()
    expect(asButton(highCalibre).disabled).toBe(true)
    fireEvent.click(highCalibre)
    expect(highCalibre.getAttribute('aria-pressed')).toBe('false')
  })
})

describe('ChoiceGroups — free-text choice', () => {
  test('renders an editable field and updates its value (no Chosen/Not Chosen stamp)', () => {
    render(<ChoiceGroups choices={[nameChoice]} parent={parent} />)
    const field = asInput(screen.getByLabelText('Name'))
    expect(field).toBeTruthy()
    // Free-text input cards carry no Chosen / Not Chosen status stamp.
    expect(screen.queryByText('Not Chosen')).toBeNull()
    expect(screen.queryByText(/^Chosen/)).toBeNull()

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

// ---------------------------------------------------------------------------
// TABLE choice render (Stage 7): A.I. Personality renders via the roll-table
// HEADER (title + Roll button), rows collapsed behind a Show/Hide toggle —
// NOT the old bare text box. Needs reference data preloaded so the roll table
// resolves by name.
// ---------------------------------------------------------------------------

const tableChoice: RefObjectChoice = {
  id: 'ai-personality',
  name: 'A.I. Personality',
  content: [{ type: 'paragraph', value: 'Roll on the A.I. Personality Table or choose your own.' }],
  source: { kind: 'table', rollTable: 'A.I. Personality', orChooseOwn: true },
}

describe('ChoiceGroups — table choice (A.I. Personality)', () => {
  test('renders the cited table header (title + roll), rows collapsed', () => {
    render(<ChoiceGroups choices={[tableChoice]} readOnly />)
    // the header names the table, and its ROLL THE DIE stamp is the roll…
    expect(screen.getByText('A.I. Personality Table')).toBeTruthy()
    expect(
      screen.getByRole('button', { name: 'Roll the die on A.I. Personality Table' })
    ).toBeTruthy()
    // …but the rows are collapsed by default (no <table> in the DOM yet)
    expect(screen.queryAllByRole('listitem').length).toBe(0)
    // read-only: no input
    expect(screen.queryByRole('textbox')).toBeNull()
  })

  test('the table is a roll Mini: its rows are its Peek, never opened in place', () => {
    const { container } = render(<ChoiceGroups choices={[tableChoice]} readOnly />)
    expect(screen.queryAllByRole('listitem').length).toBe(0)
    expect(screen.queryByRole('button', { name: /Show the .* table/i })).toBeNull()
    const trigger = container.querySelector('.su-roll-token [data-peek]')
    expect(trigger?.getAttribute('data-peek')).toMatch(/^roll-tables:.+\/table$/)
  })
})
