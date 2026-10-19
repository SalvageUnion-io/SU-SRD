/**
 * A header's summary (`chips-and-actions.md` C10, hard rule R4): a Slab's or
 * TitledBox's counts repeat no fact a child shows nor its parent's summary,
 * keep to two (C3), and are drawn by `Chips` as measures (C2a).
 */
import { describe, expect, test } from 'bun:test'
import { render } from '@testing-library/react'
import { Slab } from '../Slab'
import { SUMMARY_BUDGET, slabSummary } from '../slabSummary'

describe('slabSummary (C10)', () => {
  test("a count a child shows is not the header's to repeat", () => {
    const counts = [
      { label: 'Slots', value: 3, max: 6 },
      { label: 'SP', value: 12 },
    ]
    // The one system it holds already reads `SP | 12`.
    expect(slabSummary(counts, { children: [{ label: 'SP', value: 12 }] })).toEqual([
      { label: 'Slots', value: 3, max: 6 },
    ])
  })

  test("a count its parent's summary states is not repeated either", () => {
    const counts = [{ label: 'Slots', value: 3, max: 6 }]
    expect(slabSummary(counts, { parent: [{ label: 'slots', value: 3, max: 6 }] })).toEqual([])
  })

  test('the same label at another reading is a different fact, and stays', () => {
    const counts = [{ label: 'Slots', value: 3, max: 6 }]
    expect(slabSummary(counts, { children: [{ label: 'Slots', value: 1 }] })).toEqual(counts)
  })

  test('a header keeps to two summary chips, in order', () => {
    const counts = [
      { label: 'Systems', value: 3 },
      { label: 'Modules', value: 2 },
      { label: 'Cargo', value: 1 },
    ]
    expect(SUMMARY_BUDGET).toBe(2)
    expect(slabSummary(counts).map((count) => count.label)).toEqual(['Systems', 'Modules'])
  })
})

describe('a Slab draws its summary through Chips (C2a)', () => {
  test('each count is a measure in one strip, its note after the strip', () => {
    const { container } = render(
      <Slab
        label="Systems"
        count={[
          { label: 'Slots', value: 3, max: 6, note: 'as printed' },
          { label: 'Modules', value: 2, max: 3 },
        ]}
      />
    )
    const strip = container.querySelector('[data-chip-group]')
    const lanes = [...(strip?.querySelectorAll('[data-chip-class]') ?? [])]
    expect(lanes.map((lane) => lane.getAttribute('data-chip-class'))).toEqual(['measure'])
    expect(
      [...(strip?.querySelectorAll('.su-stat-cell') ?? [])].map((cell) => cell.textContent)
    ).toEqual(['Slots3/6', 'Modules2/3'])
    expect(strip?.parentElement?.textContent).toBe('Slots3/6Modules2/3as printed')
  })
})
