import type { Story } from '@ladle/react'
import { Flex, Box } from '@chakra-ui/react'
import { SheetInput } from './SheetInput'
import { useState } from 'react'

export default {
  title: 'Shared/SheetInput',
}

function ControlledSheetInput(props: Partial<React.ComponentProps<typeof SheetInput>>) {
  const [value, setValue] = useState(props.value ?? '')
  return <SheetInput value={value} onChange={setValue} {...props} />
}

export const Default: Story = () => (
  <Box w="300px">
    <ControlledSheetInput label="Mech Name" value="Iron Bastion" placeholder="Enter mech name" />
  </Box>
)

export const Disabled: Story = () => (
  <Box w="300px">
    <SheetInput label="Locked Field" value="Cannot edit" disabled />
  </Box>
)

export const WithDiceRoll: Story = () => (
  <Box w="300px">
    <ControlledSheetInput
      label="Attack Roll"
      value=""
      placeholder="Roll result"
      onDiceRoll={() => alert('Rolling dice!')}
    />
  </Box>
)

export const WithToggle: Story = () => {
  const [checked, setChecked] = useState(false)
  return (
    <Box w="300px">
      <ControlledSheetInput
        label="Ability"
        value="Bionic Senses"
        toggleChecked={checked}
        onToggleChange={setChecked}
      />
    </Box>
  )
}

export const WithSuffix: Story = () => (
  <Box w="300px">
    <ControlledSheetInput label="Salvage" value="15" suffixText="SP" />
  </Box>
)

export const Multiple: Story = () => (
  <Flex direction="column" gap={3} w="300px">
    <ControlledSheetInput label="Pilot Name" value="Rex Steele" />
    <ControlledSheetInput label="Mech Name" value="Iron Bastion" />
    <ControlledSheetInput label="Notes" value="" placeholder="Add notes..." />
  </Flex>
)
