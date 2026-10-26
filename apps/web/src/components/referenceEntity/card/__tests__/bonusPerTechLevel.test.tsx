/**
 * BONUS PER TECH LEVEL — one strip of label-first `Stat` chips (ruleset §3.7):
 * the hollow "Per Tech Level" lead, then each "+N" delta under its short label.
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

  test('the hollow lead, then every bonus label-first under its short label', () => {
    const { container } = render(<BonusPerTechLevel cells={cells} compact={false} />)
    const row = container.querySelector('[data-bonus-per-tech-level]')
    expect(row?.className).toContain('su-bonus-strip')
    const chips = [...(row?.children ?? [])]
    expect(chips.map((chip) => chip.textContent)).toEqual(['Per Tech Level', 'SP+3', 'EP+2'])
    expect(chips[0]?.className).toContain('su-stat-cell--hollow')
    for (const chip of chips.slice(1)) {
      const label = chip.querySelector('.su-stat-plate--label')
      expect(chip.firstElementChild).toBe(label)
    }
  })

  test('a compact card sets every chip at the Mini Size', () => {
    const { container } = render(<BonusPerTechLevel cells={cells} compact />)
    const labels = [...container.querySelectorAll('.su-stat-plate--label')]
    expect(labels).toHaveLength(3)
    for (const plate of labels) expect(plate.className).toContain('su-stat-plate--mini')
  })

  test('a Damage cell carries its unit in the value', () => {
    const { container } = render(
      <BonusPerTechLevel
        cells={[{ key: 'damage', label: 'Damage', bottomLabel: 'SP', value: '+1' }]}
        compact={false}
      />
    )
    const row = container.querySelector('[data-bonus-per-tech-level]')
    expect(row?.lastElementChild?.textContent).toBe('DMG+1 SP')
  })

  test('a stat with no short label keeps its name', () => {
    const { container } = render(
      <BonusPerTechLevel
        cells={[{ key: 'range', label: 'Range', bottomLabel: '', value: '+1' }]}
        compact={false}
      />
    )
    const row = container.querySelector('[data-bonus-per-tech-level]')
    expect(row?.lastElementChild?.textContent).toBe('Range+1')
  })
})
