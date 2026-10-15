import type { CSSProperties } from 'react'
import { useMemo } from 'react'
import { SalvageUnionReference } from 'salvageunion-reference'
import { resolveChassisRef } from 'salvageunion-reference/rules'
import { EmptyState, ReferenceEntityCard, Slab, Stat, tokens } from '../index'
import '../../styles/cantina/wizard.css'
import { fullWidthStyle } from '../wizard/wizardStyles.model'

const STAT_ROW = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: tokens.space[16],
} satisfies CSSProperties

/** The ability column (a 42rem measure). */
const ABILITIES = { maxWidth: '42rem' } satisfies CSSProperties

type MechStatsStepProps = {
  /** Chassis slug ref from the wizard form ('' while unchosen). */
  chassisName: string
}

/**
 * Step 3 · Note down your Mech's Statistics (Mech Workshop p.95) — display
 * only. Every stat derives from the chosen Chassis: SP, EP, Heat Capacity,
 * System/Module Slots, Cargo, Salvage Value, plus its unique Chassis Ability
 * rendered as the SRD entity reference card (the universal entity-card rule).
 * Nothing to choose — Next always enabled.
 */
export function MechStatsStep({ chassisName }: MechStatsStepProps) {
  const chassis = chassisName ? resolveChassisRef(chassisName) : null

  const chassisAbilities = useMemo(() => {
    if (!chassis) return []
    return SalvageUnionReference.resolveActions(chassis) ?? []
  }, [chassis])

  if (!chassis) {
    return (
      <EmptyState
        headline="No Chassis crafted"
        body="Craft a chassis first — its statistics appear here."
      />
    )
  }

  return (
    <div className="su-wiz-stack su-wiz-stack--20" style={fullWidthStyle}>
      <div style={STAT_ROW}>
        <Stat
          orientation="horizontal"
          label="SP"
          value={chassis.structurePoints}
          max={chassis.structurePoints}
        />
        <Stat
          orientation="horizontal"
          label="EP"
          value={chassis.energyPoints}
          max={chassis.energyPoints}
        />
        <Stat orientation="horizontal" label="HEAT" value={0} max={chassis.heatCapacity} />
        <Stat
          orientation="horizontal"
          label="SYS"
          value={chassis.systemSlots}
          max={chassis.systemSlots}
        />
        <Stat
          orientation="horizontal"
          label="MOD"
          value={chassis.moduleSlots}
          max={chassis.moduleSlots}
        />
        <Stat
          orientation="horizontal"
          label="CARGO"
          value={chassis.cargoCapacity}
          max={chassis.cargoCapacity}
        />
        <Stat orientation="horizontal" label="SV" value={chassis.salvageValue} />
      </div>

      {chassisAbilities.length > 0 && (
        <>
          <Slab variant="solid" label="Chassis Ability" count={chassis.name} countInk="inherit" />
          <div className="su-wiz-stack su-wiz-stack--12" style={ABILITIES}>
            {chassisAbilities.map((ability) => (
              <ReferenceEntityCard
                key={ability.id}
                data={ability}
                size="medium"
                chassisName={chassis.name}
              />
            ))}
          </div>
        </>
      )}
    </div>
  )
}
