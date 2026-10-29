import type { CSSProperties } from 'react'
import { useMemo } from 'react'
import { SalvageUnionReference } from 'salvageunion-reference'
import { resolveChassisRef } from 'salvageunion-reference/rules'
import { ActionMinis, EmptyState, Slab, Stat, tokens } from '../../components/index'
import { mechCopy } from '../../messages/build-mech'
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
        headline={mechCopy('noChassisCrafted')}
        body={mechCopy('craftAChassisFirstIts')}
      />
    )
  }

  return (
    <div className="su-wiz-stack su-wiz-stack--20" style={fullWidthStyle}>
      <div style={STAT_ROW}>
        <Stat
          label={mechCopy('sp')}
          value={chassis.structurePoints}
          max={chassis.structurePoints}
        />
        <Stat label={mechCopy('ep')} value={chassis.energyPoints} max={chassis.energyPoints} />
        <Stat label={mechCopy('heat')} value={0} max={chassis.heatCapacity} />
        <Stat label={mechCopy('sys')} value={chassis.systemSlots} max={chassis.systemSlots} />
        <Stat label={mechCopy('mod')} value={chassis.moduleSlots} max={chassis.moduleSlots} />
        <Stat label={mechCopy('cargo')} value={chassis.cargoCapacity} max={chassis.cargoCapacity} />
        <Stat label={mechCopy('sv')} value={chassis.salvageValue} />
      </div>

      {chassisAbilities.length > 0 && (
        <>
          <Slab label={mechCopy('chassisAbility')} count={chassis.name} countInk="inherit" />
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
