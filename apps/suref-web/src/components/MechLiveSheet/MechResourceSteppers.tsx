import { VStack } from '@chakra-ui/react'
import type { SURefChassis } from 'salvageunion-reference'
import { getStructurePoints, getEnergyPoints, getHeatCapacity } from 'salvageunion-reference'
import NumericStepper from '../NumericStepper'
import { Card } from '../shared/Card'
import { useHydratedMech, useUpdateMech } from '../../hooks/mech'

interface MechResourceSteppersProps {
  id: string
  /** Disables all steppers */
  disabled?: boolean
  /** Greys out the Card background (only for missing required data) */
  incomplete?: boolean
}

export function MechResourceSteppers({
  id,
  disabled = false,
  incomplete = false,
}: MechResourceSteppersProps) {
  const { mech, selectedChassis } = useHydratedMech(id)
  const updateMech = useUpdateMech()
  const chassisRef = selectedChassis?.ref as SURefChassis | undefined
  const maxSP = chassisRef ? (getStructurePoints(chassisRef) ?? 0) : 0
  const currentDamage = mech?.current_damage ?? 0
  const currentEP = mech?.current_ep ?? 0
  const currentHeat = mech?.current_heat ?? 0
  const currentSP = maxSP - currentDamage

  return (
    <Card bg="su.green" disabled={incomplete}>
      <VStack alignItems="center" gap={2} h="full" justifyContent="space-between">
        <NumericStepper
          label="SP"
          value={currentSP}
          onChange={(newSP) =>
            updateMech.mutate({ id, updates: { current_damage: maxSP - newSP } })
          }
          max={maxSP}
          min={0}
          disabled={disabled}
        />
        <NumericStepper
          label="EP"
          value={currentEP}
          onChange={(newEP) => updateMech.mutate({ id, updates: { current_ep: newEP } })}
          max={chassisRef ? (getEnergyPoints(chassisRef) ?? 0) : 0}
          disabled={disabled}
        />
        <NumericStepper
          label="HEAT"
          value={currentHeat}
          onChange={(newHeat) => updateMech.mutate({ id, updates: { current_heat: newHeat } })}
          max={chassisRef ? (getHeatCapacity(chassisRef) ?? 0) : 0}
          disabled={disabled}
        />
      </VStack>
    </Card>
  )
}
