/**
 * CHOICE REGION — an option that IS an entity sits inside its host card, so
 * it is that entity's Token (EDL N1, N2), never a head-only Row:
 * - read-only, every option is a Token that reads, and only the chosen one
 *   carries a "Chosen" seal on its line;
 * - editable, each Token IS the toggle (EDL Modes): `data-choice-toggle`
 *   marks it, it is pressed when chosen, an unchosen one is dimmed, and no
 *   seal is drawn;
 * - an editable catalog choice's pick is the picked entity's Token.
 */
import { describe, expect, test } from 'bun:test'
import { fireEvent, render, screen } from '@testing-library/react'
import type { RefObjectChoice } from 'salvageunion-reference'
import { getChoices, SalvageUnionReference } from 'salvageunion-reference'
import type { ChoiceSelections } from '../../choiceCard/choiceSelectionHelpers'
import { ReferenceEntityCard } from '../ReferenceEntityCard'

const need = <T,>(value: T | undefined, label: string): T => {
  if (value === undefined) throw new Error(`fixture missing: ${label}`)
  return value
}
/** Bionic Senses: a catalog choice of three named Modules (the optics). */
const bionicSenses = () =>
  need(SalvageUnionReference.Abilities.getByName('Bionic Senses'), 'Bionic Senses')
const armamentBay = () =>
  need(SalvageUnionReference.CrawlerBays.getByName('Armament Bay'), 'Armament Bay')
const firstChoice = (entity: Parameters<typeof getChoices>[0]): RefObjectChoice =>
  need(getChoices(entity)?.[0], 'its first choice')

/** The Token whose name is `name`, by its name element. */
function tokenNamed(container: HTMLElement, name: string): HTMLElement {
  const names = [...container.querySelectorAll('.su-entity-token__name')]
  const match = names.find((el) => el.firstChild?.textContent === name)
  const token = match?.closest<HTMLElement>('.su-entity-token')
  if (!token) throw new Error(`no Token named ${name}`)
  return token
}

describe('ChoiceRegion — read-only entity options', () => {
  test('each option is a Token; the chosen one alone is sealed "Chosen" on its line', () => {
    const choice = firstChoice(bionicSenses())
    const { container } = render(
      <ReferenceEntityCard data={bionicSenses()} selections={{ [choice.id]: ['Thermal Optics'] }} />
    )
    const chosen = tokenNamed(container, 'Thermal Optics')
    const line = chosen.parentElement
    expect(line?.classList.contains('su-entity-token-line')).toBe(true)
    expect(line?.textContent).toContain('Chosen')
    expect(screen.getAllByText('Chosen')).toHaveLength(1)
    // An unchosen option is a bare Token: no line, no seal.
    const zoom = tokenNamed(container, 'Zoom Optics')
    expect(zoom.parentElement?.classList.contains('su-entity-token-line')).toBe(false)
    // Read-only, nothing is a toggle.
    expect(container.querySelector('[data-choice-toggle]')).toBeNull()
    expect(container.querySelector('[aria-pressed]')).toBeNull()
  })

  test('with nothing chosen, no option is sealed', () => {
    render(<ReferenceEntityCard data={bionicSenses()} />)
    expect(screen.queryByText('Chosen')).toBeNull()
  })
})

describe('ChoiceRegion — editable entity options', () => {
  test('each Token is the toggle: pressed when chosen, unchosen ones dimmed, no seal', () => {
    const choice = firstChoice(bionicSenses())
    const { container } = render(
      <ReferenceEntityCard
        data={bionicSenses()}
        selections={{ [choice.id]: ['Thermal Optics'] }}
        onSelectionChange={() => {}}
      />
    )
    const toggles = [...container.querySelectorAll('[data-choice-toggle]')]
    expect(toggles).toHaveLength(3)
    const thermal = screen.getByRole('button', { name: 'Thermal Optics' })
    const zoom = screen.getByRole('button', { name: 'Zoom Optics' })
    expect(thermal.getAttribute('aria-pressed')).toBe('true')
    expect(zoom.getAttribute('aria-pressed')).toBe('false')
    expect(thermal.classList.contains('su-ec-outer--unselectable')).toBe(false)
    expect(zoom.classList.contains('su-ec-outer--unselectable')).toBe(true)
    // The pressed state is the mark: no "Chosen" seal beside a toggle.
    expect(screen.queryByText('Chosen')).toBeNull()
  })

  test('pressing an option picks it', () => {
    const choice = firstChoice(bionicSenses())
    const calls: ChoiceSelections[] = []
    render(
      <ReferenceEntityCard
        data={bionicSenses()}
        selections={{}}
        onSelectionChange={(next) => calls.push(next)}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: 'Zoom Optics' }))
    expect(calls.at(-1)?.[choice.id]).toEqual(['Zoom Optics'])
  })
})

describe('ChoiceRegion — an editable catalog pick', () => {
  test("the picked entity is its Token, above the picker's Change button", () => {
    const choice = firstChoice(armamentBay())
    const { container } = render(
      <ReferenceEntityCard
        data={armamentBay()}
        selections={{ [choice.id]: ['Red Laser'] }}
        onSelectionChange={() => {}}
      />
    )
    const pick = tokenNamed(container, 'Red Laser')
    expect(pick).toBeTruthy()
    expect(screen.getByRole('button', { name: /Change — Red Laser/ })).toBeTruthy()
  })
})
