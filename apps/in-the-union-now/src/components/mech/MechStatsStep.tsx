import { useMemo } from 'react'
import { SalvageUnionReference } from 'salvageunion-reference'
import { ReferenceEntityDisplay, StatDisplay, TreeSep, entityHostTone } from 'suref-react'
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
      <p className="m-0 font-body text-sm text-current">
        Craft a Chassis first — its statistics appear here.
      </p>
    )
  }

  return (
    <div className="w-full space-y-5">
      <div className="flex flex-wrap gap-4">
        <StatDisplay
          pips
          label="SP"
          name="Structure Pts"
          tone="sp"
          size="sm"
          value={chassis.structurePoints}
          max={chassis.structurePoints}
          editable={false}
        />
        <StatDisplay
          pips
          label="EP"
          name="Energy Pts"
          tone="ep"
          size="sm"
          value={chassis.energyPoints}
          max={chassis.energyPoints}
          editable={false}
        />
        <StatDisplay
          pips
          label="HEAT"
          name="Heat Cap"
          tone="heat"
          size="sm"
          value={chassis.heatCapacity}
          max={chassis.heatCapacity}
          editable={false}
        />
        <StatDisplay
          pips
          label="SYS"
          name="System Slots"
          size="sm"
          value={chassis.systemSlots}
          max={chassis.systemSlots}
          editable={false}
        />
        <StatDisplay
          pips
          label="MOD"
          name="Module Slots"
          size="sm"
          value={chassis.moduleSlots}
          max={chassis.moduleSlots}
          editable={false}
        />
        <StatDisplay
          pips
          label="CARGO"
          name="Cargo Cap"
          tone="cargo"
          size="sm"
          value={chassis.cargoCapacity}
          max={chassis.cargoCapacity}
          editable={false}
        />
        <StatDisplay
          pips
          label="SV"
          name="Salvage Value"
          size="sm"
          value={chassis.salvageValue}
          showPips={false}
          editable={false}
        />
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
