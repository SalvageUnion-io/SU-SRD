import type { Story } from '@ladle/react'
import { useMemo, useState } from 'react'
import { SalvageUnionReference, nameToSlug } from 'salvageunion-reference'
import type { SURefEntity, SURefMetaEntity } from 'salvageunion-reference'
import { resolveChassisRef } from 'salvageunion-reference/rules'
import { Stat } from '../../../components/shared/Stat'
import { TreeSep } from '../../../components/chrome/TreeSep'
import { ReferenceEntityDisplay } from '../../../components/referenceEntity/card/referenceEntityDisplayShim'
import { entityHostTone } from '../../../components/referenceEntity/card/entityCardTone'
import { Caption } from '../../_harness'

// biome-ignore lint/style/useComponentExportOnlyModules: Ladle stories require a default meta export alongside story components
export default { title: 'Legacy/Wizard/Mech Stats Step' }

/**
 * Verbatim reproduction of the presentational body of
 * apps/in-the-union-now/src/components/mech/MechStatsStep.tsx (lines 19-65):
 * a flex-wrap row of compact Stats derived from the chosen chassis (SP, EP,
 * HEAT, SYS, MOD, CARGO, SV), then the chassis's unique Chassis Ability rendered
 * as the SRD entity reference card (host-toned). Display only. Real chassis
 * fixture resolved via `resolveChassisRef` + `SalvageUnionReference.resolveActions`.
 */
function LegacyMechStatsStep({ chassisName }: { chassisName: string }) {
  const chassis = chassisName ? resolveChassisRef(chassisName) : null

  const chassisAbilities = useMemo(() => {
    if (!chassis) return []
    return SalvageUnionReference.resolveActions(chassis as unknown as SURefMetaEntity) ?? []
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

export const Default: Story = () => {
  const first = SalvageUnionReference.Chassis.all()[0]
  const [chassisName] = useState(first ? nameToSlug(first.name) : '')
  return (
    <div className="flex flex-col gap-4">
      <Caption>Legacy · Mech Stats step (ITUN MechStatsStep, lines 19-65)</Caption>
      <LegacyMechStatsStep chassisName={chassisName} />
    </div>
  )
}

export const NoChassis: Story = () => (
  <div className="flex flex-col gap-4">
    <Caption>Legacy · Mech Stats step, no chassis chosen (empty branch)</Caption>
    <LegacyMechStatsStep chassisName="" />
  </div>
)
