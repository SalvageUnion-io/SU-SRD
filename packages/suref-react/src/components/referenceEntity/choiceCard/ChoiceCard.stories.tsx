import type { Story } from '@ladle/react'
import { useState } from 'react'
import { ChoiceCard, FreeTextChoiceCard, StaticChoiceCard } from './ChoiceCard'

// biome-ignore lint/style/useComponentExportOnlyModules: Ladle stories require a default meta export alongside story components
export default {
  title: 'Reference Entity/ChoiceCard',
}

export const NotChosen: Story = () => (
  <div className="w-[280px] pt-3">
    <ChoiceCard
      label="Ballistic"
      description="Deals kinetic damage."
      chosen={false}
      onToggle={() => {}}
      parentHeaderBg="bg-su-green"
    />
  </div>
)

export const Chosen: Story = () => (
  <div className="w-[280px] pt-3">
    <ChoiceCard
      label="Energy"
      description="Deals energy damage."
      chosen
      onToggle={() => {}}
      parentHeaderBg="bg-su-green"
    />
  </div>
)

export const Disabled: Story = () => (
  <div className="w-[280px] pt-3">
    <ChoiceCard
      label="Rangefinder"
      description="Increases Range to Far."
      chosen={false}
      disabled
      parentHeaderBg="bg-su-green"
    />
  </div>
)

export const Compact: Story = () => (
  <div className="w-[220px] pt-3">
    <ChoiceCard
      label="Laser Guidance"
      description="Spend 2 AP to hit."
      chosen
      compact
      onToggle={() => {}}
      parentHeaderBg="bg-su-green"
    />
  </div>
)

/** Interactive toggle — click cycles Not Chosen -> Chosen. */
export const Interactive: Story = () => {
  const [chosen, setChosen] = useState(false)
  return (
    <div className="w-[280px] pt-3">
      <ChoiceCard
        label="High Calibre Rounds"
        description="+1 SP damage."
        chosen={chosen}
        onToggle={() => setChosen((c) => !c)}
        parentHeaderBg="bg-su-green"
      />
    </div>
  )
}

export const FreeTextEditable: Story = () => (
  <div className="w-[320px] pt-3">
    <FreeTextChoiceCard
      label="Name"
      description="The name of your companion."
      value=""
      onValueChange={() => {}}
      parentHeaderBg="bg-su-green"
    />
  </div>
)

export const FreeTextWithValue: Story = () => (
  <div className="w-[320px] pt-3">
    <FreeTextChoiceCard
      label="Appearance"
      value="A rusted quadruped drone with a single glowing optic."
      onValueChange={() => {}}
      multiline
      parentHeaderBg="bg-su-green"
    />
  </div>
)

export const FreeTextReadOnly: Story = () => (
  <div className="w-[320px] pt-3">
    <FreeTextChoiceCard
      label="A.I. Personality"
      value="Cheerfully paranoid."
      onValueChange={() => {}}
      readOnly
      parentHeaderBg="bg-su-green"
    />
  </div>
)

export const StaticListItem: Story = () => (
  <div className="w-[320px] pt-3">
    <StaticChoiceCard
      label="Scavenger's Luck"
      description="Once per session, reroll a failed Salvage check."
      parentHeaderBg="bg-su-green"
    />
  </div>
)

export const StaticUnlabelledBullet: Story = () => (
  <div className="w-[320px] pt-3">
    <StaticChoiceCard
      description="Scour the wastelands for a working power cell."
      parentHeaderBg="bg-su-green"
    />
  </div>
)
