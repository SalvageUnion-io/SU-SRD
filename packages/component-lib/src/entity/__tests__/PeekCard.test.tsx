/**
 * A PEEK's footer wears the header band (owner, 2026-10-14): the same fill as
 * the card's head, with the foreground measured against it. Off a Peek the
 * footer stays ink on the card's paper.
 */
import { describe, expect, test } from 'bun:test'
import { render, screen } from '@testing-library/react'
import { SalvageUnionReference } from 'salvageunion-reference'
import { ReferenceEntityCard } from '../../components/referenceEntity/card/ReferenceEntityCard'
import { PeekCard } from '../PeekCard'

const frost = () => {
  const system = SalvageUnionReference.Systems.getByName('Frost Protection')
  if (!system) throw new Error('fixture missing: Frost Protection')
  return system
}

/** The footer's own block: the type label's row's parent. */
const footerOf = () => {
  const row = screen.getByText('System').parentElement
  const footer = row?.parentElement
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

  test('a card off a Peek keeps its footer on paper', () => {
    render(<ReferenceEntityCard data={frost()} size="small" extent="full" />)
    expect(footerOf().style.background).toBe('')
  })
})

describe('Peek of a chassis ability', () => {
  const action = (name: string) => {
    const found = SalvageUnionReference.getByNameIn('actions', name)
    if (!found) throw new Error(`fixture missing: ${name}`)
    return found
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
