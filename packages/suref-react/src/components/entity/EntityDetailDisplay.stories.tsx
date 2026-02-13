import type { Story } from '@ladle/react'
import { EntityDetailDisplay } from './EntityDetailDisplay'
import { EntityDisplay } from './EntityDisplay/index'
import { SalvageUnionReference } from 'salvageunion-reference'

export default {
  title: 'Entity/EntityDetailDisplay',
}

// EntityDetailDisplay is typically rendered as a child of EntityDisplay
const system = SalvageUnionReference.Systems.all()[0]

export const WithinEntityDisplay: Story = () => (
  <div className="w-[500px]">
    <EntityDisplay data={system}>
      <div className="flex gap-2 flex-wrap p-2">
        <EntityDetailDisplay label="Blast" schemaName="traits" />
        <EntityDetailDisplay label="Range" value={2} schemaName="traits" />
        <EntityDetailDisplay label="Salvage" schemaName="keywords" />
      </div>
    </EntityDisplay>
  </div>
)

export const Compact: Story = () => (
  <div className="w-[400px]">
    <EntityDisplay data={system} compact>
      <div className="flex gap-1 flex-wrap p-1">
        <EntityDetailDisplay label="Blast" schemaName="traits" compact />
        <EntityDetailDisplay label="Range" value={2} schemaName="traits" compact />
      </div>
    </EntityDisplay>
  </div>
)
