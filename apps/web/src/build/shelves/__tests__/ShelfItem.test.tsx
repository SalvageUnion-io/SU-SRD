import { describe, expect, test } from 'bun:test'
import { render } from '@testing-library/react'
import { ShelfItem } from '../ShelfItem'

describe('ShelfItem (C4: a shelf names a unit by its defining fact)', () => {
  test('the defining fact takes the place of the vital', () => {
    const { container } = render(
      <ul>
        <ShelfItem
          kind="pilot"
          name="Bonesaw"
          note="Engineer"
          reading={{ label: 'HP', value: '8/10' }}
          chips={[]}
          menu={[]}
        />
      </ul>
    )
    expect(container.textContent).toContain('Class')
    expect(container.textContent).toContain('Engineer')
    expect(container.textContent).not.toContain('8/10')
  })

  test('with no defining fact, the vital stands', () => {
    const { container } = render(
      <ul>
        <ShelfItem
          kind="npc"
          name="Scrap Hound"
          reading={{ label: 'HP', value: '4/4' }}
          chips={[]}
          menu={[]}
        />
      </ul>
    )
    expect(container.textContent).toContain('4/4')
  })
})
