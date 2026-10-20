import type { CSSProperties } from 'react'
import { useMemo } from 'react'
import { SalvageUnionReference } from 'salvageunion-reference'
import { resolveChassisRef } from 'salvageunion-reference/rules'
import { EmptyState, Slab, Stat, tokens } from '../../components/index'
import { ActionMinis } from '../../components/referenceEntity/card/NestedCards'
import '../../styles/build/wizard.css'
import { fullWidthStyle } from '../wizard/wizardStyles.model'

const STAT_ROW = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: tokens.space[16],
} satisfies CSSProperties

/** The ability list (a 42rem measure). */
const ABILITIES = { maxWidth: '42rem' } satisfies CSSProperties

type MechStatsStepProps = {
  /** Chassis slug ref from the wizard form ('' while unchosen). */
  chassisName: string
}

/**
 * Step 3 · Note down your Mech's Statistics (Mech Workshop p.95) — display
 * only. Every stat derives from the chosen Chassis: SP, EP, Heat Capacity,
 * System/Module Slots, Cargo, Salvage Value, plus its unique Chassis Ability.
 * The ability is the chassis's, nested in it, so it is a contentful Mini
 * (N3, E19) as any nested action is (`ActionMinis`): its head, then its full
 * text, `[(CHASSIS)]` naming the chassis, and its roll table on the line under it.
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
        <Stat label="SP" value={chassis.structurePoints} max={chassis.structurePoints} />
        <Stat label="EP" value={chassis.energyPoints} max={chassis.energyPoints} />
        <Stat label="HEAT" value={0} max={chassis.heatCapacity} />
        <Stat label="SYS" value={chassis.systemSlots} max={chassis.systemSlots} />
        <Stat label="MOD" value={chassis.moduleSlots} max={chassis.moduleSlots} />
        <Stat label="CARGO" value={chassis.cargoCapacity} max={chassis.cargoCapacity} />
        <Stat label="SV" value={chassis.salvageValue} />
      </div>

      {chassisAbilities.length > 0 && (
        <>
          <Slab label="Chassis Ability" count={chassis.name} countInk="inherit" />
          <div style={ABILITIES}>
            <ActionMinis
              actions={chassisAbilities}
              size="compact"
              hostName={chassis.name}
              chassisName={chassis.name}
            />
          </div>
        </>
      )}
    </div>
  )
}
