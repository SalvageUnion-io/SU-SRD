import { VStack, Flex } from '@chakra-ui/react'
import type { SURefChassis } from 'salvageunion-reference'
import {
  getChassisAbilities,
  getSystemSlots,
  getModuleSlots,
  getCargoCapacity,
} from 'salvageunion-reference'
import { Card } from '../shared/Card'
import { StatDisplay } from '../StatDisplay'
import { NestedChassisAbility } from '../entity/NestedChassisAbility'

interface ChassisAbilitiesProps {
  chassis: SURefChassis | undefined
  totalSalvageValue: number
  disabled?: boolean
}

export function ChassisAbilities({
  totalSalvageValue,
  chassis,
  disabled = false,
}: ChassisAbilitiesProps) {
  const chassisAbilities = chassis ? getChassisAbilities(chassis) : undefined

  return (
    <Card
      rightContent={
        <Flex flexDirection="row" justifyContent="flex-end" gap={4}>
          <StatDisplay
            label="Sys."
            bottomLabel="Slots"
            value={chassis ? (getSystemSlots(chassis) ?? 0) : 0}
            disabled={disabled}
            hoverText="Each System has a System Slot value which represents how much space it takes up on a Mech, conversely a Mechs System Slot value represents how many Systems it can mount. This is an abstract value that covers not only size, but energy requirements, ammo storage and a host of other factors."
          />
          <StatDisplay
            label="Mod."
            bottomLabel="Slots"
            value={chassis ? (getModuleSlots(chassis) ?? 0) : 0}
            disabled={disabled}
            hoverText="Each Module has a Module Slot value which represents how much space it takes up on a Mech, conversely a Mech's Module Slot value represents how many Modules it can mount."
          />
          <StatDisplay
            label="Cargo"
            bottomLabel="Cap"
            value={chassis ? (getCargoCapacity(chassis) ?? 0) : 0}
            disabled={disabled}
            hoverText="A Mech's Cargo Slots represents how much it can carry. By default a Mech has 6 Cargo Slots. Cargo Capacity can be increased by installing Systems such as Transport Holds or Cargo Bays into your Mech, as well as from some unique Chassis and Pilot Abilities."
          />
          <StatDisplay
            label="Cargo"
            bottomLabel="Value"
            value={totalSalvageValue}
            disabled={disabled}
            hoverText="The combined Salvage Value of the chassis and all attached systems and modules, irrespective of tech value"
          />
        </Flex>
      }
      bg="su.green"
      title="Chassis Abilities"
      disabled={!chassis}
    >
      <VStack gap={3} alignItems="stretch" w="full">
        {chassisAbilities && chassisAbilities.length > 0
          ? chassisAbilities.map((ability) => (
              <NestedChassisAbility
                key={ability.id}
                data={ability}
                compact={false}
                chassisName={chassis?.name}
              />
            ))
          : null}
      </VStack>
    </Card>
  )
}
