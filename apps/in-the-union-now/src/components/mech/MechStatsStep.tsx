import { useMemo } from 'react'
import { SalvageUnionReference } from 'salvageunion-reference'
import { NestedChassisAbility, StatBlock, TreeSep } from 'suref-react'
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
        <StatBlock
          code="SP"
          name="Structure Pts"
          stat="sp"
          size="sm"
          value={chassis.structurePoints}
          max={chassis.structurePoints}
          editable={false}
        />
        <StatBlock
          code="EP"
          name="Energy Pts"
          stat="ep"
          size="sm"
          value={chassis.energyPoints}
          max={chassis.energyPoints}
          editable={false}
        />
        <StatBlock
          code="HEAT"
          name="Heat Cap"
          stat="heat"
          size="sm"
          value={chassis.heatCapacity}
          max={chassis.heatCapacity}
          editable={false}
        />
        <StatBlock
          code="SYS"
          name="System Slots"
          size="sm"
          value={chassis.systemSlots}
          max={chassis.systemSlots}
          editable={false}
        />
        <StatBlock
          code="MOD"
          name="Module Slots"
          size="sm"
          value={chassis.moduleSlots}
          max={chassis.moduleSlots}
          editable={false}
        />
        <StatBlock
          code="CARGO"
          name="Cargo Cap"
          stat="cargo"
          size="sm"
          value={chassis.cargoCapacity}
          max={chassis.cargoCapacity}
          editable={false}
        />
        <StatBlock
          code="SV"
          name="Salvage Value"
          size="sm"
          value={chassis.salvageValue}
          pips={false}
          editable={false}
        />
      </div>

      {chassisAbilities.length > 0 && (
        <>
          <TreeSep name="Chassis Ability" suffix={chassis.name} />
          <div className="max-w-2xl space-y-3">
            {chassisAbilities.map((ability) => (
              <NestedChassisAbility
                key={ability.id}
                data={ability}
                compact
                chassisName={chassis.name}
              />
            ))}
          </div>
        </>
      )}
    </div>
  )
}
