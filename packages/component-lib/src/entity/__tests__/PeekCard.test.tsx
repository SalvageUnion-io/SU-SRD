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

const scrap = () => {
  const ability = SalvageUnionReference.Abilities.getByName('Scrap')
  if (!ability) throw new Error('fixture missing: Scrap')
  return ability
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

  // The Peek wears the fill of the Token or Row that opened it (owner,
  // 2026-10-14): an ability's tier tone, not the card's ink banner.
  test("an ability's Peek wears its tier tone, as its Token does", () => {
    const { container } = render(<PeekCard entity={scrap()} />)
    expect(container.querySelector('[style*="--color-pilot"]')).not.toBeNull()
  })
})
