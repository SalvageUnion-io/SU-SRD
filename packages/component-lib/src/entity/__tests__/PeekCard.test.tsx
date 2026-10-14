/**
 * A PEEK's footer wears the header band (owner, 2026-10-14): the same fill as
 * the card's head, with the foreground measured against it. Off a Peek the
 * footer stays ink on the card's paper. Neither names the kind (E9).
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
})
