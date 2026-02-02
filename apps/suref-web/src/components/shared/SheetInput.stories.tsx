import type { Story } from '@ladle/react'
import { SheetInput } from './SheetInput'
import { useState } from 'react'
import { Box } from '@chakra-ui/react'

export default {
  title: 'Shared/SheetInput',
}

export const Default: Story = () => {
  const [value, setValue] = useState('Default value')
  return (
    <Box w="300px">
      <SheetInput label="Callsign" value={value} onChange={setValue} placeholder="Enter name" />
    </Box>
  )
}

export const WithPlaceholder: Story = () => {
  const [value, setValue] = useState('')
  return (
    <Box w="300px">
      <SheetInput label="Name" value={value} onChange={setValue} placeholder="Enter pilot name" />
    </Box>
  )
}

export const Disabled: Story = () => (
  <Box w="300px">
    <SheetInput label="Locked Field" value="Cannot edit" disabled />
  </Box>
)

export const WithToggle: Story = () => {
  const [value, setValue] = useState('Background story')
  const [checked, setChecked] = useState(false)
  return (
    <Box w="300px">
      <SheetInput
        label="Background"
        value={value}
        onChange={setValue}
        toggleChecked={checked}
        onToggleChange={setChecked}
        toggleLabel="Used"
      />
    </Box>
  )
}

export const WithDiceRoll: Story = () => {
  const [value, setValue] = useState('10')
  return (
    <Box w="300px">
      <SheetInput
        label="Damage"
        value={value}
        onChange={setValue}
        onDiceRoll={() => alert('Rolling dice!')}
        diceRollAriaLabel="Roll damage"
        diceRollTitle="Click to roll"
      />
    </Box>
  )
}

export const WithSuffix: Story = () => {
  const [value, setValue] = useState('5')
  return (
    <Box w="300px">
      <SheetInput label="Structure Points" value={value} onChange={setValue} suffixText="SP" />
    </Box>
  )
}

export const WithChildren: Story = () => {
  const [value, setValue] = useState('Test')
  return (
    <Box w="300px">
      <SheetInput label="Custom" value={value} onChange={setValue}>
        <Box mt={2} p={2} bg="gray.100" borderRadius="md" fontSize="sm">
          Helper text below the input
        </Box>
      </SheetInput>
    </Box>
  )
}

export const NonOwner: Story = () => (
  <Box w="300px">
    <SheetInput label="Other Player's Field" value="View only" disabled isOwner={false} />
  </Box>
)

export const AllFeatures: Story = () => {
  const [value, setValue] = useState('Full Example')
  const [checked, setChecked] = useState(true)
  return (
    <Box w="400px">
      <SheetInput
        label="Complete Input"
        value={value}
        onChange={setValue}
        placeholder="Enter value"
        toggleChecked={checked}
        onToggleChange={setChecked}
        toggleLabel="Active"
        onDiceRoll={() => alert('Rolling!')}
        diceRollAriaLabel="Roll"
        suffixText="pts"
      />
    </Box>
  )
}
