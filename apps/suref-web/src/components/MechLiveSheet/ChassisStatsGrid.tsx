import { Flex } from '@chakra-ui/react'
import { StatDisplay } from '../StatDisplay'
import type { SURefChassis } from 'salvageunion-reference'
import { getSystemSlots, getModuleSlots, getCargoCapacity } from 'salvageunion-reference'
import { Card } from '../shared/Card'

interface ChassisStatsGridProps {
  chassis: SURefChassis | undefined
  usedSystemSlots: number
  usedModuleSlots: number
  totalCargo: number
  disabled?: boolean
  totalSalvageValue: number
}

export function ChassisStatsGrid({
  chassis,
  usedSystemSlots,
  usedModuleSlots,
  totalCargo,
  totalSalvageValue,
  disabled = false,
}: ChassisStatsGridProps) {
  return (
    <Card bg="su.green" h="full" flex="1" disabled={disabled}>
      <Flex
        flexDirection="row"
        justifyContent="space-between"
        w="full"
        h="full"
        alignItems="center"
      >
        <StatDisplay
          label="System"
          bottomLabel="Slots"
          value={usedSystemSlots}
          outOfMax={chassis ? (getSystemSlots(chassis) ?? 0) : 0}
          disabled={disabled}
          hoverText="Each System has a System Slot value which represents how much space it takes up on a Mech, conversely a Mechs System Slot value represents how many Systems it can mount. This is an abstract value that covers not only size, but energy requirements, ammo storage and a host of other factors."
        />
        <StatDisplay
          label="Module"
          bottomLabel="Slots"
          value={usedModuleSlots}
          outOfMax={chassis ? (getModuleSlots(chassis) ?? 0) : 0}
          disabled={disabled}
          hoverText="Each Module has a Module Slot value which represents how much space it takes up on a Mech, conversely a Mech's Module Slot value represents how many Modules it can mount."
        />
        <StatDisplay
          label="Cargo"
          bottomLabel="Cap"
          value={totalCargo}
          outOfMax={chassis ? (getCargoCapacity(chassis) ?? 0) : 0}
          disabled={disabled}
          hoverText="A Mech's Cargo Slots represents how much it can carry. By default a Mech has 6 Cargo Slots. Cargo Capacity can be increased by installing Systems such as Transport Holds or Cargo Bays into your Mech, as well as from some unique Chassis and Pilot Abilities."
        />
        <StatDisplay
          label="Total"
          bottomLabel="SV"
          value={totalSalvageValue}
          disabled={disabled}
          hoverText="Salvage Value represents the sum of a Mech, System, or Module's material components. As such it's the amount of Scrap you receive when breaking down a Chassis, System, or Module, as well as the amount of Scrap required to craft a Mech, System, or Module."
        />
      </Flex>
    </Card>
  )
}
