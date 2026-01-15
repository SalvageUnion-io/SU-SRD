import { VStack } from '@chakra-ui/react'
import NumericStepper from '../NumericStepper'
import { Card } from '../shared/Card'
import { useHydratedPilot, useUpdatePilot } from '../../hooks/pilot'

interface PilotResourceSteppersProps {
  id: string
  /** Disables all steppers */
  disabled?: boolean
  /** Greys out the Card background (only for missing required data) */
  incomplete?: boolean
}

export function PilotResourceSteppers({
  id,
  disabled = false,
  incomplete = false,
}: PilotResourceSteppersProps) {
  const { pilot } = useHydratedPilot(id)
  const maxHP = pilot?.max_hp ?? 10
  const currentDamage = pilot?.current_damage ?? 0
  const maxAP = pilot?.max_ap ?? 5
  const currentAP = pilot?.current_ap ?? 5
  const currentTP = pilot?.current_tp ?? 0
  const updateEntity = useUpdatePilot()
  const currentHP = maxHP - currentDamage

  return (
    <Card bg="bg.builder.pilot" disabled={incomplete}>
      <VStack alignItems="center" justifyContent="space-between" h="full">
        <NumericStepper
          label="HP"
          value={currentHP}
          onChange={(newHP) =>
            updateEntity.mutate({ id, updates: { current_damage: maxHP - newHP } })
          }
          max={maxHP}
          min={0}
          disabled={disabled}
        />
        <NumericStepper
          label="AP"
          value={currentAP}
          onChange={(newAP) => updateEntity.mutate({ id, updates: { current_ap: newAP } })}
          max={maxAP}
          disabled={disabled}
        />
        <NumericStepper
          label="TP"
          value={currentTP}
          onChange={(newTP) => updateEntity.mutate({ id, updates: { current_tp: newTP } })}
          disabled={disabled}
        />
      </VStack>
    </Card>
  )
}
