import type { Story } from '@ladle/react'
import { SheetDisplay } from './SheetDisplay'
import { Text } from '../base/Text'

// biome-ignore lint/style/useComponentExportOnlyModules: Ladle stories require a default meta export alongside story components
export default {
  title: 'Shared/SheetDisplay',
}

export const Default: Story = () => (
  <div className="w-[300px]">
    <SheetDisplay label="Mech Name" value="Iron Bastion" />
  </div>
)

export const Compact: Story = () => (
  <div className="w-[300px]">
    <SheetDisplay label="Pilot" value="Rex Steele" compact />
  </div>
)

export const CustomLabelColor: Story = () => (
  <div className="w-[300px]">
    <SheetDisplay label="Crawler" value="The Dustrunner" labelColor="text-su-pink" />
  </div>
)

export const WithChildren: Story = () => (
  <div className="w-[300px]">
    <SheetDisplay label="Description">
      <Text className="text-sm">
        A heavily modified salvage mech with reinforced armor plating.
      </Text>
    </SheetDisplay>
  </div>
)

export const Multiple: Story = () => (
  <div className="flex flex-wrap gap-4">
    <div className="w-[200px]">
      <SheetDisplay label="Structure Points" value="8 / 8" />
    </div>
    <div className="w-[200px]">
      <SheetDisplay label="Energy Points" value="6 / 6" />
    </div>
    <div className="w-[200px]">
      <SheetDisplay label="Heat" value="0 / 6" />
    </div>
  </div>
)
