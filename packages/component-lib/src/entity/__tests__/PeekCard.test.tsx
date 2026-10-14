/**
 * A PEEK's footer wears the header band (owner, 2026-10-14): the same fill as
 * the card's head, with the foreground measured against it. Off a Peek the
 * footer stays ink on the card's paper. Neither names the kind (E9).
 */
import { describe, expect, test } from 'bun:test'
import { render, screen } from '@testing-library/react'
import type { SURefEntity } from 'salvageunion-reference'
import { SalvageUnionReference } from 'salvageunion-reference'
import { ReferenceEntityCard } from '../../components/referenceEntity/card/ReferenceEntityCard'
import { PeekCard } from '../PeekCard'

const frost = () => {
  const system = SalvageUnionReference.Systems.getByName('Frost Protection')
  if (!system) throw new Error('fixture missing: Frost Protection')
  return system
}

const scrap = () => {
  const ability = SalvageUnionReference.Abilities.getByName('Scrap')
  if (!ability) throw new Error('fixture missing: Scrap')
  return ability
}

/** The footer's own block: the citation's cluster's row's parent. */
const footerOf = () => {
  const footer = screen.getByText(/· p\.\d+/).parentElement?.parentElement?.parentElement
  if (!footer) throw new Error('footer not found')
  return footer
}

describe('Peek footer', () => {
  test('paints the header band behind it', () => {
    render(<PeekCard entity={frost()} />)
    const footer = footerOf()
    expect(footer.style.background).not.toBe('')
    expect(footer.style.color).toMatch(/var\(--color-(ink|paper)\)/)
  })

  test('names no kind: only a Page foot stamps it (E9); the cite stays text', () => {
    render(<PeekCard entity={frost()} />)
    expect(footerOf().textContent).not.toContain('System')
    expect(footerOf().textContent).toMatch(/· p\.\d+/)
  })

  test('a card off a Peek keeps its footer on paper', () => {
    render(<ReferenceEntityCard data={frost()} size="small" extent="full" />)
    expect(footerOf().style.background).toBe('')
  })

  // The Peek wears the fill of the Token or Row that opened it (owner,
  // 2026-10-14): an ability's tier tone, not the card's ink banner.
  test("an ability's Peek wears its tier tone, as its Token does", () => {
    const { container } = render(<PeekCard entity={scrap()} />)
    expect(container.querySelector('[style*="--color-pilot"]')).not.toBeNull()
  })

  // The dulled band is a nested color-mix() the test DOM drops, so this sees
  // only that the plain tone is gone; paint.test.ts and cardSeams.test.ts pin
  // the exact mix.
  test("a damaged trigger's Peek no longer wears the plain tone", () => {
    const { container } = render(<PeekCard entity={scrap()} down />)
    expect(container.querySelector('[style*="--color-pilot"]')).toBeNull()
  })
})

describe('Peek of a chassis ability', () => {
  const action = (name: string) => {
    const found = SalvageUnionReference.getByNameIn('actions', name)
    if (!found) throw new Error(`fixture missing: ${name}`)
    // A Peek opens any ref, an action's included (`PeekHost`).
    return found as unknown as SURefEntity
  }

  test('names its one chassis where the book says [(CHASSIS)]', () => {
    const { container } = render(<PeekCard entity={action('Integrated Cargo Bay')} />)
    expect(container.textContent).not.toContain('[(CHASSIS)]')
    expect(container.textContent).toContain('The Mule')
  })

  test('an ability several chassis share reads "The Mech"', () => {
    const { container } = render(<PeekCard entity={action('Fast')} />)
    expect(container.textContent).not.toContain('[(CHASSIS)]')
    expect(container.textContent).toContain('The Mech')
  })
})

// Owner's call, 2026-10-14: peeking a chassis shows its chassis ability, not
// its patterns.
describe('Peek of a chassis', () => {
  const mule = () => {
    const chassis = SalvageUnionReference.Chassis.getByName('Mule')
    if (!chassis) throw new Error('fixture missing: Mule')
    return chassis
  }

  test('shows its chassis ability as a Row', () => {
    render(<PeekCard entity={mule()} />)
    const list = screen.getByRole('list', { name: 'Chassis ability' })
    expect(list.textContent).toContain('Integrated Cargo Bay')
    expect(list.textContent).toContain('The Mule')
    expect(list.textContent).not.toContain('[(CHASSIS)]')
  })

  test('lists none of its patterns', () => {
    const { container } = render(<PeekCard entity={mule()} />)
    for (const pattern of mule().patterns ?? []) {
      expect(container.textContent).not.toContain(pattern.name)
    }
  })
})
