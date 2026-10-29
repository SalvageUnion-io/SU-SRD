import { describe, expect, test } from 'bun:test'
import { render } from '@testing-library/react'
import { MasonryColumns } from '../MasonryColumns'

const cards = (names: string[]) =>
  names.map((name) => (
    <button key={name} type="button">
      {name}
    </button>
  ))

describe('MasonryColumns', () => {
  test('the cards stand in source order, so Tab reads them as the columns do', () => {
    const { container } = render(
      <MasonryColumns>{cards(['a', 'b', 'c', 'd', 'e'])}</MasonryColumns>
    )
    const order = [...container.querySelectorAll('button')].map((b) => b.textContent)
    expect(order).toEqual(['a', 'b', 'c', 'd', 'e'])
    expect(container.querySelectorAll('.su-masonry > .su-masonry__item')).toHaveLength(5)
  })

  test('a card keeps its element across a re-render: nothing remounts', () => {
    const { container, rerender } = render(
      <MasonryColumns maxColumns={2}>{cards(['a', 'b', 'c'])}</MasonryColumns>
    )
    const before = container.querySelector('button')
    rerender(<MasonryColumns maxColumns={3}>{cards(['a', 'b', 'c'])}</MasonryColumns>)
    expect(container.querySelector('button')).toBe(before)
  })

  test('the cap is a class the stylesheet reads', () => {
    const { container } = render(<MasonryColumns maxColumns={2}>{cards(['a'])}</MasonryColumns>)
    expect(container.querySelector('.su-masonry')?.classList.contains('su-masonry--max-2')).toBe(
      true
    )
  })

  test('a radio flow is a named radiogroup, and needs its name', () => {
    const { getByRole } = render(
      <MasonryColumns radio ariaLabel="Chassis">
        {cards(['a'])}
      </MasonryColumns>
    )
    expect(getByRole('radiogroup', { name: 'Chassis' })).toBeTruthy()
    // @ts-expect-error a radio group without its accessible name
    const unnamed = <MasonryColumns radio>{cards(['a'])}</MasonryColumns>
    expect(unnamed).toBeDefined()
  })
})
