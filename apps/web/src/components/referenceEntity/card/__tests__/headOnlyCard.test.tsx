/**
 * A HEAD-ONLY card closes on its head. A nested action with nothing but its
 * name and chips (a creature's Stinger) draws no paper strip under its cut-out:
 * the lead gap (`CardLead`) opens only when nested content follows the head,
 * so a card with no nested groups must not count an empty fragment as some.
 * What its head cannot hold opens a body (owner, 2026-10-20): its overflow
 * row, hidden while every chip fits.
 */
import { describe, expect, test } from 'bun:test'
import { render } from '@testing-library/react'
import { SalvageUnionReference } from 'salvageunion-reference'
import { ReferenceEntityCard } from '../ReferenceEntityCard'

const scorpion = () => {
  const found = SalvageUnionReference.Creatures.getByName('Irradiated Scorpion')
  if (!found) throw new Error('Irradiated Scorpion fixture missing')
  return found
}

describe('a head-only card', () => {
  test("a creature's bodiless action ends on its head, with no gap under it", () => {
    const { container } = render(<ReferenceEntityCard data={scorpion()} presentation="page" />)
    const title = [...container.querySelectorAll('h3')].find((h) =>
      h.textContent?.startsWith('Stinger')
    )
    const frame = title?.closest('.su-ec-frame')
    expect(frame).toBeTruthy()
    const [, ...under] = [...(frame?.children ?? [])]
    expect(under.map((el) => el.hasAttribute('data-chip-overflow'))).toEqual([true])
    expect((under[0] as HTMLElement).hidden).toBe(true)
    expect(frame?.querySelector('[aria-hidden="true"][style*="height"]')).toBeNull()
  })
})
