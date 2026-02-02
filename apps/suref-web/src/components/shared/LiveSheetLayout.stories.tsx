import type { Story } from '@ladle/react'
import { LiveSheetLayout } from './LiveSheetLayout'
import { Box, VStack, HStack } from '@chakra-ui/react'
import { Text } from '../base/Text'
import { Card } from './Card'

export default {
  title: 'Shared/LiveSheetLayout',
}

export const Default: Story = () => (
  <LiveSheetLayout>
    <Text>Live sheet content goes here</Text>
  </LiveSheetLayout>
)

export const WithCards: Story = () => (
  <LiveSheetLayout>
    <VStack gap={4} alignItems="stretch">
      <Card title="Header Section" bg="su.orange">
        <Text>Character header information</Text>
      </Card>
      <HStack gap={4} alignItems="stretch">
        <Card title="Stats" bg="su.lightBlue" flex={1}>
          <Text>Stats content</Text>
        </Card>
        <Card title="Abilities" bg="su.green" flex={1}>
          <Text>Abilities content</Text>
        </Card>
      </HStack>
    </VStack>
  </LiveSheetLayout>
)

export const PilotSheetExample: Story = () => (
  <LiveSheetLayout>
    <VStack gap={4} alignItems="stretch">
      <Card title="Pilot Name" bg="su.orange" label="Pilot">
        <HStack gap={4}>
          <Box flex={1}>
            <Text fontWeight="bold">Callsign</Text>
            <Text>Steel Thunder</Text>
          </Box>
          <Box flex={1}>
            <Text fontWeight="bold">Class</Text>
            <Text>Soldier</Text>
          </Box>
        </HStack>
      </Card>
      <HStack gap={4}>
        <Card title="HP: 8/10" bg="su.lightBlue" compact flex={1} />
        <Card title="AP: 3/5" bg="su.lightBlue" compact flex={1} />
        <Card title="TP: 2" bg="su.lightBlue" compact flex={1} />
      </HStack>
    </VStack>
  </LiveSheetLayout>
)

export const MechSheetExample: Story = () => (
  <LiveSheetLayout>
    <VStack gap={4} alignItems="stretch">
      <Card title="Atlas" bg="su.green" label="Mech">
        <HStack gap={4}>
          <Box flex={1}>
            <Text fontWeight="bold">Chassis</Text>
            <Text>Atlas</Text>
          </Box>
          <Box flex={1}>
            <Text fontWeight="bold">Tech Level</Text>
            <Text>1</Text>
          </Box>
        </HStack>
      </Card>
      <HStack gap={4}>
        <Card title="SP: 20/20" bg="su.green" compact flex={1} />
        <Card title="EP: 8/8" bg="su.green" compact flex={1} />
      </HStack>
    </VStack>
  </LiveSheetLayout>
)
