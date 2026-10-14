import type { CSSProperties } from 'react'
import { space } from '../../../design/tokens'
import { Stat } from '../../atoms/Stat'
import type { BonusCell } from './cardCells'

const STACK = { display: 'flex', flexDirection: 'column', gap: space[6] } satisfies CSSProperties

const CELLS = {
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'flex-start',
  gap: space[6],
} satisfies CSSProperties

/**
 * BONUS PER TECH LEVEL — its own distinct rendering, anchored INLINE at the
 * prose that describes it (choice-plan): the green "Bonus per Tech Level" label
 * + the "+N" deltas, each a label-first chip (`Damage | +1 SP`).
 */
export function BonusPerTechLevel({ cells, compact }: { cells: BonusCell[]; compact: boolean }) {
  return (
    <div className="su-ec-block" style={STACK}>
      <Stat
        orientation="horizontal"
        label="Bonus per Tech Level"
        bgColor="var(--color-status-ok)"
        textColor="var(--color-paper)"
        size={compact ? 'compact' : 'full'}
      />
      <div style={CELLS}>
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
              size={compact ? 'compact' : 'full'}
            />
          )
        })}
      </div>
    </div>
  )
}
