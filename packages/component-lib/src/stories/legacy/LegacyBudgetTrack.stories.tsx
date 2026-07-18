import type { Story } from '@ladle/react'
import { SalvageUnionReference } from 'salvageunion-reference'
import { statBlockRowStarts } from '../../components/stat/pipRows'
import { cn } from '../../utils/cn'
import { Caption } from '../_harness'

// biome-ignore lint/style/useComponentExportOnlyModules: Ladle stories require a default meta export alongside story components
export default { title: 'Legacy/Loadout Budget Track' }

type BudgetTrackProps = {
  /** Track label, e.g. 'SYSTEM SLOTS', 'ENERGY'. */
  label: string
  value: number
  max: number
  /** 'ap' renders rust pips (ENERGY); default ink. Over-budget pips go red. */
  tone?: 'default' | 'ap'
}

/**
 * Verbatim reproduction of the hand-rolled BudgetTrack pip gauge from
 * apps/in-the-union-now/src/components/mech/LoadoutPanel.tsx (lines 22-68).
 * Pip budget track for the install-step Loadout panel (design §3.2 mech):
 * '{LABEL} · n / max' over a ≤6-per-row pip strip. The track renders
 * max(max, value) pips so over-capacity is displayed honestly (red pips,
 * never clamped) — capacity stays a soft warning.
 */
function BudgetTrack({ label, value, max, tone = 'default' }: BudgetTrackProps) {
  const total = Math.max(max, value)
  const isOver = value > max
  const fill = tone === 'ap' ? 'border-rust bg-rust' : 'border-ink bg-ink'

  return (
    <div>
      <p className="font-cond text-badge font-bold uppercase tracking-widest text-ink">
        {label} ·{' '}
        <span className={cn('font-body text-xs font-bold', isOver ? 'text-status-bad' : '')}>
          {value} / {max}
        </span>
      </p>
      {total > 0 && (
        <div
          className="mt-1.5 flex flex-col gap-1"
          role="img"
          aria-label={`${label} ${value} of ${max}`}
        >
          {statBlockRowStarts(total).map(({ count, start }) => (
            <div key={start} className="flex gap-1">
              {Array.from({ length: count }).map((_, c) => {
                const i = start + c
                const on = i < value
                const over = i >= max
                return (
                  <span
                    key={i}
                    data-pip={on ? 'on' : 'off'}
                    className={cn(
                      'h-[13px] w-[13px] rounded-[2px] border-chrome',
                      on
                        ? over
                          ? 'border-status-bad bg-status-bad'
                          : fill
                        : 'border-ink bg-transparent'
                    )}
                  />
                )
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export const Default: Story = () => {
  // Real capacities sourced from the first chassis in the dataset.
  const chassis = SalvageUnionReference.Chassis.all()[0]
  const systemMax = chassis?.systemSlots ?? 6
  const energyMax = chassis?.energyPoints ?? 4

  return (
    <div className="flex flex-col gap-6">
      <Caption>
        Legacy · hand-rolled BudgetTrack pip gauge (ITUN LoadoutPanel) — duplicates VitalGauge /
        Stat + SlotGrid
      </Caption>

      <div className="flex flex-col gap-4">
        <Caption>Under cap</Caption>
        <BudgetTrack label="System Slots" value={Math.max(0, systemMax - 3)} max={systemMax} />
        <BudgetTrack label="Energy" value={Math.max(0, energyMax - 1)} max={energyMax} tone="ap" />
      </div>

      <div className="flex flex-col gap-4">
        <Caption>At cap</Caption>
        <BudgetTrack label="System Slots" value={systemMax} max={systemMax} />
        <BudgetTrack label="Energy" value={energyMax} max={energyMax} tone="ap" />
      </div>

      <div className="flex flex-col gap-4">
        <Caption>Over cap (red pips)</Caption>
        <BudgetTrack label="System Slots" value={systemMax + 2} max={systemMax} />
        <BudgetTrack label="Energy" value={energyMax + 1} max={energyMax} tone="ap" />
      </div>
    </div>
  )
}
