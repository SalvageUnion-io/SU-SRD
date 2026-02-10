import type { Story } from '@ladle/react'
import { Box } from '@chakra-ui/react'
import { RollTable } from './RollTable'
import { SalvageUnionReference } from 'salvageunion-reference'

export default {
  title: 'Shared/RollTable',
}

// Get a real roll table from game data
const rollTableEntity = SalvageUnionReference.RollTables.all()[0]
const rollTable = rollTableEntity && 'table' in rollTableEntity ? rollTableEntity.table : undefined

// Simple mock table as fallback
const mockTable = {
  type: 'standard' as const,
  '20': 'Critical Success: Double damage and bonus effect',
  '11-19': 'Hit: Standard damage applied',
  '6-10': 'Glancing Blow: Half damage applied',
  '2-5': 'Miss: No damage dealt',
  '1': 'Critical Failure: Weapon jams, take 1 Structure Point damage',
}

export const WithGameData: Story = () => (
  <Box w="600px">
    <RollTable
      table={rollTable ?? mockTable}
      showCommand
      tableName={rollTableEntity?.name ?? 'Attack Roll'}
    />
  </Box>
)

export const BasicTable: Story = () => (
  <Box w="600px">
    <RollTable table={mockTable} />
  </Box>
)

export const WithCommand: Story = () => (
  <Box w="600px">
    <RollTable table={mockTable} showCommand tableName="Attack Roll" />
  </Box>
)

export const Compact: Story = () => (
  <Box w="400px">
    <RollTable table={mockTable} compact showCommand tableName="Attack Roll" />
  </Box>
)

export const Disabled: Story = () => (
  <Box w="600px">
    <RollTable table={mockTable} showCommand tableName="Attack Roll" disabled />
  </Box>
)
