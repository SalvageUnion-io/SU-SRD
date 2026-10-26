import { cn } from '../../../lib/cn'
import { referenceEntityCopy } from '../../../messages/components-reference-entity'
import { Stat } from '../../atoms/Stat'
import type { BonusCell } from './cardCells'

/** Each bonus's short label, the stat codes the chips use (ruleset §2.6). */
const SHORT_LABEL: Record<string, string> = {
  'Structure Points': 'SP',
  'Energy Points': 'EP',
  'Heat Capacity': 'Heat',
  'System Slots': 'SYS',
  'Module Slots': 'MODS',
  'Cargo Capacity': 'Cargo',
  'Salvage Value': 'SV',
  Damage: 'DMG',
}

/**
 * BONUS PER TECH LEVEL — anchored INLINE at the prose that describes it
 * (choice-plan): one strip of label-first `Stat` chips (ruleset §3.7) butted
 * edge to edge (`.su-bonus-strip`), the hollow `Per Tech Level` lead first,
 * then each "+N" delta under its short label (`SP | +3`). Damage carries its
 * unit in the value (`DMG | +1 SP`).
 */
export function BonusPerTechLevel({ cells, compact }: { cells: BonusCell[]; compact: boolean }) {
  const size = compact ? 'mini' : 'compact'
  return (
    <div className={cn('su-ec-block', 'su-bonus-strip')} data-bonus-per-tech-level="">
      <Stat label={referenceEntityCopy('perTechLevel')} hollow size={size} />
      {cells.map((cell) => {
        const damage = cell.label.toLowerCase() === 'damage'
        const unit = cell.bottomLabel ? ` ${cell.bottomLabel}` : ''
        const name = damage ? cell.label : `${cell.label}${unit}`
        return (
          <Stat
            key={cell.key}
            label={SHORT_LABEL[name] ?? name}
            value={damage ? `${cell.value}${unit}` : cell.value}
            size={size}
          />
        )
      })}
    </div>
  )
}
