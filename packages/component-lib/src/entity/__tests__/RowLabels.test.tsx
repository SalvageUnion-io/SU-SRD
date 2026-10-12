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

describe('Row labels', () => {
  test('the kind stamp sits right of the name, on its line', () => {
    render(<Entity form="row" entity={drill()} />)
    const head = headOf('Salvaging Drill')
    expect(head.firstElementChild?.className).toBe('su-entity-row__line')
    const labels = screen.getByText('Salvaging Drill').nextElementSibling
    expect(labels?.textContent).toBe('System')
  })

  test('omitting the kind drops the stamp from the name line', () => {
    render(<Entity form="row" entity={drill()} omit={['kind']} />)
    expect(screen.queryByText('System')).toBeNull()
    expect(headOf('Salvaging Drill').firstElementChild?.className).toBe('su-entity-row__line')
  })

  test('the ink banner carries its kind stamp inside the band too', () => {
    render(<Entity form="row" entity={juryRig()} />)
    const head = headOf('Jury Rig')
    expect(head.dataset.fill).toBe('ink')
    const labels = screen.getByText('Jury Rig').nextElementSibling
    expect(labels?.textContent).toContain('Ability')
    expect(head.contains(labels ?? null)).toBe(true)
  })
})
