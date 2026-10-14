/**
 * CLASS KIND STAMP + HYBRID REQUIREMENTS, on the card.
 *
 * A pilot class card names WHICH KIND of class it is in its labels — `[Class |
 * BASE / HYBRID / NON-ADVANCEABLE]` — and a hybrid additionally names the two
 * ability trees it advances from in the sub-header row, joined by "or". The
 * derivation itself is the entity model's (salvageunion-reference
 * `view/__tests__/classKind.test.ts`); these tests pin how the card shows it.
 */
import { describe, expect, test } from 'bun:test'
import { render, screen } from '@testing-library/react'
import { SalvageUnionReference } from 'salvageunion-reference'
import { resolveAxisMarkers } from '../entityCardTone'
import { ReferenceEntityCard } from '../ReferenceEntityCard'

const classByName = (name: string) => {
  const found = SalvageUnionReference.Classes.getByName(name)
  if (!found) throw new Error(`class fixture missing: ${name}`)
  return found
}

describe('class kind axis marker', () => {
  test('the kind sits in the labels as a [Class | KIND] axis marker', () => {
    expect(resolveAxisMarkers(classByName('Ranger'))).toEqual([{ label: 'Class', value: 'HYBRID' }])
    expect(resolveAxisMarkers(classByName('Salvager'))).toEqual([
      { label: 'Class', value: 'NON-ADVANCEABLE' },
    ])
    expect(resolveAxisMarkers(classByName('Soldier'))).toEqual([{ label: 'Class', value: 'BASE' }])
  })
})

describe('class card rendering', () => {
  test('a hybrid renders its two requirement trees, joined by "or"', () => {
    render(<ReferenceEntityCard data={classByName('Cyborg')} />)
    // A Stat cell (E17): `[REQ | Augmentation or Gladiatorial Combat]`.
    expect(screen.getByText('REQ')).toBeTruthy()
    expect(screen.getByText('Augmentation or Gladiatorial Combat')).toBeTruthy()
  })

  test('a base class renders no requirements at all', () => {
    render(<ReferenceEntityCard data={classByName('Soldier')} />)
    expect(screen.queryByText('REQ')).toBeNull()
  })

  test('the Salvager stamps NON-ADVANCEABLE and asks for no trees', () => {
    render(<ReferenceEntityCard data={classByName('Salvager')} />)
    expect(screen.getByText('NON-ADVANCEABLE')).toBeTruthy()
    expect(screen.queryByText('REQ')).toBeNull()
  })

  test('the [Class | KIND] pill stands in for the "Class" type stamp, never beside it', () => {
    // The list row and the full card alike: one "Class" stamp, the pill's
    // label cell — not a type stamp reading "Class" before it.
    for (const extent of ['head', undefined] as const) {
      const { container, unmount } = render(
        <ReferenceEntityCard data={classByName('Cyborg')} size="medium" extent={extent} />
      )
      const stamps = [...container.querySelectorAll('.su-badge-stamp')].filter(
        (stamp) => stamp.textContent === 'Class'
      )
      expect(stamps).toHaveLength(1)
      expect(stamps[0]?.parentElement?.classList.contains('su-stat-cell')).toBe(true)
      expect(stamps[0]?.previousElementSibling?.textContent).toBe('HYBRID')
      unmount()
    }
  })

  test('the kind stamp survives extent="catalog" — the deliberate exception', () => {
    // Catalog tiles suppress card chrome, but the class kind is exempt: a reader
    // scanning the class index needs to know a hybrid is unavailable at creation
    // before opening anything.
    render(<ReferenceEntityCard data={classByName('Smuggler')} extent="catalog" />)
    expect(screen.getByText('HYBRID')).toBeTruthy()
  })
})
