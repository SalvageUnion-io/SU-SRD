/**
 * A Row whose model has nothing for its body (a roll table with no opening
 * prose) is its head alone, and says so (`data-bodyless`), so a grid can keep
 * it a head tall rather than stretch an empty paper strip under it.
 */
import { describe, expect, test } from 'bun:test'
import { render } from '@testing-library/react'
import type { SURefEntity } from 'salvageunion-reference'
import { SalvageUnionReference } from 'salvageunion-reference'
import { Entity } from '../Entity'

const need = <T,>(value: T | undefined, label: string): T => {
  if (value === undefined) throw new Error(`fixture missing: ${label}`)
  return value
}
const table = (name: string) =>
  need(SalvageUnionReference.RollTables.getByName(name), name) as SURefEntity

describe('Row body', () => {
  test('a Row with nothing to say past its head has no body and is marked bodyless', () => {
    const { container } = render(<Entity form="row" entity={table('Reactor Overload')} lead />)
    expect(container.querySelector('.su-entity-row__body')).toBeNull()
    expect(container.querySelector('.su-entity-row__frame[data-bodyless]')).not.toBeNull()
  })

  test('a Row with a lead keeps its body and no bodyless mark', () => {
    const { container } = render(<Entity form="row" entity={table('Core Mechanic')} lead />)
    expect(container.querySelector('.su-entity-row__body')).not.toBeNull()
    expect(container.querySelector('.su-entity-row__frame[data-bodyless]')).toBeNull()
  })
})
