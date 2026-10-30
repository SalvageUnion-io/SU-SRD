/**
 * A Compact whose model has nothing for its body (a roll table with no opening
 * prose) is its head alone, and says so (`data-bodyless`), so a grid can keep
 * it a head tall rather than stretch an empty paper strip under it.
 */
import { describe, expect, test } from 'bun:test'
import { render } from '@testing-library/react'
import type { RefEntity } from 'salvageunion-reference'
import { SalvageUnionReference } from 'salvageunion-reference'
import { readPackageStylesheet } from '../../../styles/__tests__/packageStylesheet'
import { Entity } from '../Entity'

const need = <T,>(value: T | undefined, label: string): T => {
  if (value === undefined) throw new Error(`fixture missing: ${label}`)
  return value
}
const table = (name: string) =>
  need(SalvageUnionReference.RollTables.getByName(name), name) as RefEntity

describe('Compact body', () => {
  test('a Compact with nothing to say past its head has no body and is marked bodyless', () => {
    const { container } = render(<Entity size="compact" entity={table('Mechapult')} lead />)
    expect(container.querySelector('.su-entity-compact__body')).toBeNull()
    expect(container.querySelector('.su-entity-compact__frame[data-bodyless]')).not.toBeNull()
  })

  test('a Compact with a lead keeps its body and no bodyless mark', () => {
    const { container } = render(<Entity size="compact" entity={table('Core Mechanic')} lead />)
    expect(container.querySelector('.su-entity-compact__body')).not.toBeNull()
    expect(container.querySelector('.su-entity-compact__frame[data-bodyless]')).toBeNull()
  })

  test('a Peeking Compact opens no native tooltip beside its Peek; a still one keeps it', () => {
    const still = render(<Entity size="compact" entity={table('Core Mechanic')} lead />)
    expect(still.container.querySelector('.su-entity-compact__title')?.getAttribute('title')).toBe(
      'Core Mechanic'
    )
    expect(still.container.querySelector('.su-entity-lead')?.hasAttribute('title')).toBe(true)
    const peeking = render(<Entity size="compact" entity={table('Core Mechanic')} lead peek />)
    expect(peeking.container.querySelector('[title]')).toBeNull()
  })

  test('a bodyless Compact taller than its head fills with its band and sets its name at the foot', () => {
    const css = readPackageStylesheet().replace(/\s+/g, ' ')
    expect(css).toContain(
      '.su-entity-compact__frame[data-bodyless] > .su-entity-compact__main > .su-entity-compact__head { flex: 1 1 auto; justify-content: flex-end; }'
    )
  })
})
