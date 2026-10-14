import type { CSSProperties } from 'react'
import { space } from '../../../design/tokens'
import { Stat } from '../../atoms/Stat'
import type { BonusCell } from './cardCells'

const CELLS = {
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  gap: space[6],
} satisfies CSSProperties

/**
 * BONUS PER TECH LEVEL — anchored INLINE at the prose that describes it
 * (choice-plan): one wrapping row of label-first `Stat` chips (ruleset §3.7),
 * the ink "Bonus per Tech Level" chip leading, then each "+N" delta
 * (`Damage | +1 SP`, `Structure Points | +3`). Every chip is the same ink
 * plate.
 */
export function BonusPerTechLevel({ cells, compact }: { cells: BonusCell[]; compact: boolean }) {
  const size = compact ? 'compact' : 'full'
  return (
    <div className="su-ec-block" style={CELLS} data-bonus-per-tech-level="">
      <Stat orientation="horizontal" label="Bonus per Tech Level" size={size} />
      {cells.map((cell) => {
        // Every cell is a label-first chip: Damage carries its unit in the
        // value (`Damage | +1 SP`), any other stat its whole name in the
        // label (`Structure Points | +1`).
        const damage = cell.label.toLowerCase() === 'damage'
        const unit = cell.bottomLabel ? ` ${cell.bottomLabel}` : ''
        return (
          <Stat
            key={cell.key}
            orientation="horizontal"
            label={damage ? cell.label : `${cell.label}${unit}`}
            value={damage ? `${cell.value}${unit}` : cell.value}
            size={size}
          />
        )
      })}
    </div>
  )
}
