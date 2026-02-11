import type { Story } from '@ladle/react'
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
  <div className="w-[300px]">
    <ControlledSheetInput label="Mech Name" value="Iron Bastion" placeholder="Enter mech name" />
  </div>
)

export const Disabled: Story = () => (
  <div className="w-[300px]">
    <SheetInput label="Locked Field" value="Cannot edit" disabled />
  </div>
)

export const WithToggle: Story = () => {
  const [checked, setChecked] = useState(false)
  return (
    <div className="w-[300px]">
      <ControlledSheetInput
        label="Ability"
        value="Bionic Senses"
        toggleChecked={checked}
        onToggleChange={setChecked}
      />
    </div>
  )
}

export const WithSuffix: Story = () => (
  <div className="w-[300px]">
    <ControlledSheetInput label="Salvage" value="15" suffixText="SP" />
  </div>
)

export const Multiple: Story = () => (
  <div className="flex w-[300px] flex-col gap-3">
    <ControlledSheetInput label="Pilot Name" value="Rex Steele" />
    <ControlledSheetInput label="Mech Name" value="Iron Bastion" />
    <ControlledSheetInput label="Notes" value="" placeholder="Add notes..." />
  </div>
)
