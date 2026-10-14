/**
 * BONUS PER TECH LEVEL — one row of label-first ink `Stat` chips (ruleset
 * §3.7): the "Bonus per Tech Level" chip leading, then each "+N" delta, the
 * label before the value.
 */
import { describe, expect, test } from 'bun:test'
import { render } from '@testing-library/react'
import { BonusPerTechLevel } from '../BonusPerTechLevel'
import { bonusCells } from '../cardCells'

describe('BonusPerTechLevel', () => {
  const cells = bonusCells({
    structurePoints: 3,
    energyPoints: 2,
    heatCapacity: 0,
    techLevel: 1,
  })

  test('every chip is label-first, the lead chip first, in one row', () => {
    const { container } = render(<BonusPerTechLevel cells={cells} compact={false} />)
    const row = container.querySelector('[data-bonus-per-tech-level]')
    const chips = [...(row?.children ?? [])]
    expect(chips.map((chip) => chip.textContent)).toEqual([
      'Bonus per Tech Level',
      'Structure Points+3',
      'Energy Points+2',
    ])
    for (const chip of chips.slice(1)) {
      const label = chip.querySelector('.su-stat-plate--label')
      expect(label).not.toBeNull()
      expect(chip.firstElementChild).toBe(label)
    }
  })

  test('a compact card sets every chip at the compact rung', () => {
    const { container } = render(<BonusPerTechLevel cells={cells} compact />)
    const labels = [...container.querySelectorAll('.su-stat-plate--label')]
    expect(labels).toHaveLength(3)
    for (const plate of labels) expect(plate.className).toContain('su-stat-plate--compact')
  })

  test('a Damage cell carries its unit in the value', () => {
    const { container } = render(
      <BonusPerTechLevel
        cells={[{ key: 'damage', label: 'Damage', bottomLabel: 'SP', value: '+1' }]}
        compact={false}
      />
    )
    const row = container.querySelector('[data-bonus-per-tech-level]')
    expect(row?.lastElementChild?.textContent).toBe('Damage+1 SP')
  })
})
