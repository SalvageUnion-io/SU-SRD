/**
 * A HEAD-ONLY action closes on its head. A nested action with nothing but its
 * name and chips (a creature's Stinger) is a Mini whose body holds only what
 * its head cannot: its overflow row, hidden while every chip fits, so the
 * body draws no paper strip under the tab (`.su-entity-mini__body:has(>
 * .su-chip-overflow[hidden]:only-child)`).
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
  test("a creature's bodiless action ends on its head, with nothing under it but its hidden overflow row", () => {
    const { container } = render(<ReferenceEntityCard data={scorpion()} presentation="page" />)
    const mini = [...container.querySelectorAll('.su-entity-mini')].find((el) =>
      el.querySelector('.su-entity-mini__name')?.textContent?.startsWith('Stinger')
    )
    expect(mini).toBeTruthy()
    const under = [...(mini?.querySelector('.su-entity-mini__body')?.children ?? [])]
    expect(under.map((el) => el.hasAttribute('data-chip-overflow'))).toEqual([true])
    expect((under[0] as HTMLElement).hidden).toBe(true)
  })
})
