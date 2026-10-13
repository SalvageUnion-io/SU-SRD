/**
 * A Row's head: its labels (the User-made stamp, a unit's note) sit on the
 * name's line, right of the name — never a stamp riding the frame, never a
 * line above it. The kind is never stamped (E9): the title carries it for
 * screen readers. The chips share the name's heading (E17).
 */
import { describe, expect, test } from 'bun:test'
import { render, screen } from '@testing-library/react'
import { SalvageUnionReference } from 'salvageunion-reference'
import { Entity } from '../Entity'

const need = <T,>(value: T | undefined, label: string): T => {
  if (value === undefined) throw new Error(`fixture missing: ${label}`)
  return value
}
const drill = () => need(SalvageUnionReference.Systems.getByName('Salvaging Drill'), 'drill')
const juryRig = () => need(SalvageUnionReference.Abilities.getByName('Jury Rig'), 'jury rig')
const keyword = () => need(SalvageUnionReference.Keywords.all()[0], 'a keyword')

const headOf = (name: string) => {
  const head = screen.getByText(name).closest('.su-entity-row__head')
  if (!(head instanceof HTMLElement)) throw new Error('no head band')
  return head
}

/** The name's box on the band: its paper cut-out over a body, else the title itself. */
const nameBox = (name: string) => {
  const title = screen.getByText(name)
  return title.closest('.su-entity-row__notch') ?? title
}

describe('Row labels', () => {
  test('the kind is no stamp: the title ends with it, for screen readers only', () => {
    render(<Entity form="row" entity={drill()} />)
    const head = headOf('Salvaging Drill')
    expect(head.firstElementChild?.className).toBe('su-entity-row__line')
    const kind = head.querySelector('.su-entity-row__title .su-sr-only')
    expect(kind?.textContent).toBe(' (System)')
    expect(head.querySelector('.su-entity-row__labels')?.textContent ?? '').toBe('')
  })

  test('the chips share the heading with the name, in one group', () => {
    render(<Entity form="row" entity={drill()} />)
    const head = headOf('Salvaging Drill')
    const heading = head.querySelector('.su-entity-row__heading')
    expect(heading?.firstElementChild?.className).toBe('su-entity-row__name')
    expect(heading?.lastElementChild?.getAttribute('data-chip-group')).toBe('')
    // A head with chips wears no cut-out: they may drop under the name.
    expect(head.dataset.notch).toBeUndefined()
  })

  test('over a body a head with no chips sets its name on the paper cut-out', () => {
    const entry = keyword()
    render(<Entity form="row" entity={entry} lead />)
    const head = headOf(entry.name)
    expect(head.dataset.notch).toBe('true')
    expect(nameBox(entry.name).className).toBe('su-entity-row__notch')
  })

  test('omitting the kind drops it from the title too', () => {
    render(<Entity form="row" entity={drill()} omit={['kind']} />)
    expect(headOf('Salvaging Drill').querySelector('.su-sr-only')).toBeNull()
  })

  test("an ability's tier banner wears its tier; its kind and tree are read out", () => {
    render(<Entity form="row" entity={juryRig()} />)
    const head = headOf('Jury Rig')
    // A Core ability's Row wears the Core tier: orange.
    expect(head.dataset.fill).toBe('tone')
    expect(head.style.backgroundColor).toBe('var(--color-pilot)')
    expect(head.querySelector('.su-sr-only')?.textContent).toContain('Ability')
  })

  test("an ability's tier numeral leads its band, unless the context sets it (`omit` tier)", () => {
    const { unmount } = render(<Entity form="row" entity={juryRig()} />)
    expect(
      headOf('Jury Rig').querySelector('.su-entity-row__line')?.firstElementChild?.textContent
    ).toBe('1')
    unmount()
    render(<Entity form="row" entity={juryRig()} omit={['kind', 'tier']} />)
    const head = headOf('Jury Rig')
    expect(head.dataset.fill).toBe('tone')
    expect(head.textContent).not.toMatch(/^1/)
    expect(head.querySelector('.su-entity-row__title')?.textContent).toBe('Jury Rig')
  })

  test('the tier numeral stays on the band, first on the line; chips mean no cut-out', () => {
    const charge = need(SalvageUnionReference.Abilities.getByName('Charge'), 'charge')
    render(<Entity form="row" entity={charge} />)
    const head = headOf('Charge')
    const line = head.querySelector('.su-entity-row__line')
    expect(line?.firstElementChild?.className).toBe('su-entity-row__tier')
    expect(line?.firstElementChild?.textContent).toBe('1')
    // Its chips could drop under the name, so the name is on the band, not a tab.
    expect(head.dataset.notch).toBeUndefined()
    expect(head.querySelector('.su-entity-row__notch')).toBeNull()
    expect(head.textContent).toContain('Free Action')
  })
})
