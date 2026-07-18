import { useMemo } from 'react'
import { SalvageUnionReference } from 'salvageunion-reference'
import { EmptyState, ReferenceEntityDisplay, Stat, TreeSep, entityHostTone } from 'component-lib'
import type { SURefEntity, SURefMetaEntity } from 'salvageunion-reference'
import { resolveChassisRef } from '../../lib/rules/resolveRefs'

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
        headline="No Chassis Crafted"
        body="Craft a chassis first — its statistics appear here."
      />
    )
  }

  return (
    <div className="w-full space-y-5">
      <div className="flex flex-wrap gap-4">
        <Stat label="SP" value={chassis.structurePoints} max={chassis.structurePoints} compact />
        <Stat label="EP" value={chassis.energyPoints} max={chassis.energyPoints} compact />
        <Stat label="HEAT" value={chassis.heatCapacity} max={chassis.heatCapacity} compact />
        <Stat label="SYS" value={chassis.systemSlots} max={chassis.systemSlots} compact />
        <Stat label="MOD" value={chassis.moduleSlots} max={chassis.moduleSlots} compact />
        <Stat label="CARGO" value={chassis.cargoCapacity} max={chassis.cargoCapacity} compact />
        <Stat label="SV" value={chassis.salvageValue} compact />
      </div>

      {chassisAbilities.length > 0 && (
        <>
          <TreeSep name="Chassis Ability" suffix={chassis.name} />
          <div className="max-w-2xl space-y-3">
            {chassisAbilities.map((ability) => (
              <ReferenceEntityDisplay
                key={ability.id}
                data={ability as unknown as SURefEntity}
                compact
                chassisName={chassis.name}
                hostTone={entityHostTone(chassis as unknown as SURefMetaEntity)}
              />
            ))}
          </div>
        </>
      )}
    </div>
  )
}
