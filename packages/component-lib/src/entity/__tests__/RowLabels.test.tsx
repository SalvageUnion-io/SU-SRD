/**
 * A Row's labels (the kind stamp, the User-made stamp) sit on the name's line,
 * right of the name — never a stamp riding the frame, never a line above it.
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
  test('the kind stamp sits right of the name, on its line', () => {
    render(<Entity form="row" entity={drill()} />)
    const head = headOf('Salvaging Drill')
    expect(head.firstElementChild?.className).toBe('su-entity-row__line')
    const labels = nameBox('Salvaging Drill').nextElementSibling
    expect(labels?.textContent).toBe('System')
  })

  test('over a body the name sits on the paper cut-out, its labels on the band beside it', () => {
    render(<Entity form="row" entity={drill()} />)
    const head = headOf('Salvaging Drill')
    expect(head.dataset.notch).toBe('true')
    const notch = nameBox('Salvaging Drill')
    expect(notch.className).toBe('su-entity-row__notch')
    expect(notch.contains(screen.getByText('System'))).toBe(false)
  })

  test('omitting the kind drops the stamp from the name line', () => {
    render(<Entity form="row" entity={drill()} omit={['kind']} />)
    expect(screen.queryByText('System')).toBeNull()
    expect(headOf('Salvaging Drill').firstElementChild?.className).toBe('su-entity-row__line')
  })

  test("an ability's tier banner carries its kind stamp inside the band too", () => {
    render(<Entity form="row" entity={juryRig()} />)
    const head = headOf('Jury Rig')
    // A Core ability's Row wears the Core tier: orange.
    expect(head.dataset.fill).toBe('tone')
    expect(head.style.backgroundColor).toBe('var(--color-pilot)')
    const labels = nameBox('Jury Rig').nextElementSibling
    expect(labels?.textContent).toContain('Ability')
    expect(head.contains(labels ?? null)).toBe(true)
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
    expect(head.querySelector('.su-entity-row__line')?.firstElementChild?.textContent).toBe(
      'Jury Rig'
    )
  })
})
