import { ShieldAlert } from 'lucide-react'
import type { ReferenceEntityControl } from 'suref-react'
import type { PilotEditConfig } from '../../../hooks/usePilotSheet'
import type { PilotRow, MechRow } from '../../../types/common'

type BuildControlsInput = {
  pilot: PilotRow
  mech: MechRow | null | undefined
  isBoarded: boolean
  editConfig: PilotEditConfig | undefined
  onOpenSettings: () => void
  onOpenDamage: () => void
}

export function buildPilotSheetControls(
  input: BuildControlsInput
): ReferenceEntityControl[] | undefined {
  const { pilot, mech, isBoarded, editConfig, onOpenSettings, onOpenDamage } = input

  if (!editConfig) return undefined

  const settingsControl: ReferenceEntityControl = {
    key: 'settings',
    label: 'Settings',
    onClick: onOpenSettings,
    ariaLabel: 'Settings',
  }

  const boardControl: ReferenceEntityControl | undefined =
    mech && !pilot.in_downtime
      ? {
          key: 'board',
          label: pilot.is_boarded ? 'Disembark' : 'Board',
          onClick: editConfig.onToggleBoarded,
          ariaLabel: pilot.is_boarded ? 'Disembark mech' : 'Embark mech',
          variant: pilot.is_boarded ? ('danger' as const) : ('primary' as const),
          bgColor: pilot.is_boarded ? undefined : 'var(--color-su-green)',
        }
      : undefined

  const downtimeControl: ReferenceEntityControl | undefined = !pilot.crawler_id
    ? {
        key: 'downtime',
        label: 'Downtime',
        onClick: editConfig.onToggleDowntime,
        ariaLabel: pilot.in_downtime ? 'Exit downtime' : 'Enter downtime',
        bgColor: pilot.in_downtime ? 'var(--color-su-pink)' : undefined,
      }
    : undefined

  const takeDamageControl: ReferenceEntityControl | undefined =
    mech && isBoarded
      ? {
          key: 'take-damage',
          icon: ShieldAlert,
          label: 'Take Damage',
          ariaLabel: 'Apply damage to mech',
          onClick: onOpenDamage,
          variant: 'danger' as const,
        }
      : undefined

  const sheetControls = [takeDamageControl, boardControl, downtimeControl, settingsControl].filter(
    Boolean
  ) as ReferenceEntityControl[]

  return sheetControls.length > 0 ? sheetControls : undefined
}
