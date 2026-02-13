import type { Story } from '@ladle/react'
import { EntityDisplay } from '../entity/EntityDisplay/index'
import { SalvageUnionReference } from 'salvageunion-reference'

export default {
  title: 'Shared/EntityDisplayFooter',
}

// Use a real entity with page data
const systemEntity = SalvageUnionReference.Systems.all()[0]
const chassis = SalvageUnionReference.Chassis.all()[0]

const rainmakerEntity =
  SalvageUnionReference.Systems.all().find((s) => s.source === 'Rainmaker') ?? systemEntity
const wwhfEntity =
  SalvageUnionReference.Chassis.all().find((s) => s.source === 'We Were Here First!') ?? chassis
const falseFlagEntity =
  SalvageUnionReference.Systems.all().find((s) => s.source === 'False Flag') ?? systemEntity

export const WithinEntityDisplay: Story = () => (
  <div className="w-[500px]">
    <EntityDisplay data={systemEntity}>
      <div className="p-2 text-sm">Footer is shown at the bottom of this entity display.</div>
    </EntityDisplay>
  </div>
)

export const Compact: Story = () => (
  <div className="w-[400px]">
    <EntityDisplay data={systemEntity} compact>
      <div className="p-2 text-sm">Compact entity with footer.</div>
    </EntityDisplay>
  </div>
)

export const RainmakerExpansion: Story = () => (
  <div className="w-[500px] py-6">
    <EntityDisplay data={rainmakerEntity}>
      <div className="p-2 text-sm">Rainmaker - raindrops on header and footer edges.</div>
    </EntityDisplay>
  </div>
)

export const WeWereHereFirstExpansion: Story = () => (
  <div className="w-[500px] py-6">
    <EntityDisplay data={wwhfEntity}>
      <div className="p-2 text-sm">We Were Here First! - beast fangs on header and footer.</div>
    </EntityDisplay>
  </div>
)

export const FalseFlagExpansion: Story = () => (
  <div className="w-[500px]">
    <EntityDisplay data={falseFlagEntity}>
      <div className="p-2 text-sm">False Flag - Windows 95 beveled border.</div>
    </EntityDisplay>
  </div>
)
