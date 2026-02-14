import type { Story } from '@ladle/react'
import { EntityDisplay } from './EntityDisplay/index'
import { SalvageUnionReference } from 'salvageunion-reference'

export default {
  title: 'Entity/EntityDisplay',
}

const system = SalvageUnionReference.Systems.all()[0]
const module = SalvageUnionReference.Modules.all()[0]
const chassis = SalvageUnionReference.Chassis.all()[0]
const ability = SalvageUnionReference.Abilities.all()[0]
const trait = SalvageUnionReference.Traits.all()[0]

const rainmakerEntity =
  SalvageUnionReference.Systems.all().find((s) => s.source === 'Rainmaker') ?? system
const wwhfEntity =
  SalvageUnionReference.Systems.all().find((s) => s.source === 'We Were Here First!') ?? system
const falseFlagEntity =
  SalvageUnionReference.Systems.all().find((s) => s.source === 'False Flag') ?? system

export const DefaultSystem: Story = () => (
  <div className="w-[600px]">
    <EntityDisplay data={system} />
  </div>
)

export const CompactMode: Story = () => (
  <div className="w-[400px]">
    <EntityDisplay data={system} compact />
  </div>
)

export const Listing: Story = () => (
  <div className="w-[600px]">
    <EntityDisplay data={system} listing />
  </div>
)

export const Disabled: Story = () => (
  <div className="w-[600px]">
    <EntityDisplay data={system} disabled />
  </div>
)

export const Damaged: Story = () => (
  <div className="w-[600px]">
    <EntityDisplay data={system} damaged />
  </div>
)

export const CustomHeaderColor: Story = () => (
  <div className="w-[600px]">
    <EntityDisplay data={system} headerColor="bg-su-pink" />
  </div>
)

export const HiddenActions: Story = () => (
  <div className="w-[600px]">
    <EntityDisplay data={system} hideActions />
  </div>
)

export const WithFooter: Story = () => (
  <div className="w-[600px]">
    <EntityDisplay data={system} />
  </div>
)

export const DifferentSchemas: Story = () => (
  <div className="flex flex-col gap-4 w-[600px]">
    <EntityDisplay data={system} />
    <EntityDisplay data={module} />
    <EntityDisplay data={chassis} />
    <EntityDisplay data={ability} />
    <EntityDisplay data={trait} />
  </div>
)

export const DimHeader: Story = () => (
  <div className="w-[600px]">
    <EntityDisplay data={ability} dimHeader />
  </div>
)

export const ExpansionRainmaker: Story = () => (
  <div className="w-[600px] py-6">
    <EntityDisplay data={rainmakerEntity} />
  </div>
)

export const ExpansionWeWereHereFirst: Story = () => (
  <div className="w-[600px] py-6">
    <EntityDisplay data={wwhfEntity} />
  </div>
)

export const ExpansionFalseFlag: Story = () => (
  <div className="w-[600px]">
    <EntityDisplay data={falseFlagEntity} />
  </div>
)

export const AllExpansions: Story = () => (
  <div className="flex w-[600px] flex-col gap-8 py-6">
    <div>
      <p className="mb-2 text-xs font-bold uppercase tracking-wide text-su-grey-dark">Rainmaker</p>
      <EntityDisplay data={rainmakerEntity} />
    </div>
    <div>
      <p className="mb-2 text-xs font-bold uppercase tracking-wide text-su-grey-dark">
        We Were Here First!
      </p>
      <EntityDisplay data={wwhfEntity} />
    </div>
    <div>
      <p className="mb-2 text-xs font-bold uppercase tracking-wide text-su-grey-dark">False Flag</p>
      <EntityDisplay data={falseFlagEntity} />
    </div>
    <div>
      <p className="mb-2 text-xs font-bold uppercase tracking-wide text-su-grey-dark">
        No Expansion (Core)
      </p>
      <EntityDisplay data={system} />
    </div>
  </div>
)
