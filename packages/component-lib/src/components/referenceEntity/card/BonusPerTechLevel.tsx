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
 * + the "+N" deltas. Damage rides HORIZONTAL (as everywhere), other stats are
 * vertical value boxes.
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
        {cells.map((cell) =>
          cell.label.toLowerCase() === 'damage' ? (
            // Damage is always horizontal (label | +N SP), matching every other
            // Damage cell; the unit rides into the value.
            <Stat
              key={cell.key}
              orientation="horizontal"
              label={cell.label}
              value={`${cell.value}${cell.bottomLabel ? ` ${cell.bottomLabel}` : ''}`}
              size={compact ? 'compact' : 'full'}
            />
          ) : (
            <Stat
              key={cell.key}
              label={cell.label}
              bottomLabel={cell.bottomLabel}
              value={cell.value}
              // VALUE BOX, not horizontal: its rungs sit one step down, so
              // `compact` maps to `mini` here while the horizontal cells above
              // map it to `compact`. Same prop, same file, different ladder.
              size={compact ? 'mini' : 'compact'}
            />
          )
        )}
      </div>
    </div>
  )
}
