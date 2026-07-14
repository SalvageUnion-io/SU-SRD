import type { Story } from '@ladle/react'
import { StatDisplay } from './StatDisplay'

// biome-ignore lint/style/useComponentExportOnlyModules: Ladle stories require a default meta export alongside story components
export default {
  title: 'Shared/StatDisplay',
}

export const Default: Story = () => (
  <div className="flex gap-3">
    <StatDisplay label="SP" value={8} />
    <StatDisplay label="EP" value={6} />
    <StatDisplay label="HEAT" value={0} />
  </div>
)

export const WithOutOfMax: Story = () => (
  <div className="flex gap-3">
    <StatDisplay label="SP" value={5} max={8} />
    <StatDisplay label="EP" value={3} max={6} />
    <StatDisplay label="HEAT" value={2} max={6} />
  </div>
)

export const Compact: Story = () => (
  <div className="flex gap-2">
    <StatDisplay label="SP" value={8} compact />
    <StatDisplay label="EP" value={6} compact />
    <StatDisplay label="HEAT" value={0} compact />
  </div>
)

export const Disabled: Story = () => (
  <div className="flex gap-3">
    <StatDisplay label="SP" value={8} disabled />
    <StatDisplay label="EP" value={6} disabled />
  </div>
)

export const Inverse: Story = () => (
  <div className="flex gap-3">
    <StatDisplay label="SP" value={8} inverse />
    <StatDisplay label="EP" value={6} inverse />
  </div>
)

export const Clickable: Story = () => (
  <div className="flex gap-3">
    <StatDisplay label="SP" value={8} onClick={() => alert('Clicked SP!')} bottomLabel="MAX" />
    <StatDisplay label="EP" value={6} onClick={() => alert('Clicked EP!')} bottomLabel="MAX" />
  </div>
)

export const CustomColors: Story = () => (
  <div className="flex gap-3">
    <StatDisplay
      label="SP"
      value={8}
      bg="bg-su-green"
      valueColor="text-su-white"
      borderColor="border-su-green"
    />
    <StatDisplay
      label="EP"
      value={6}
      bg="bg-su-orange"
      valueColor="text-su-white"
      borderColor="border-su-orange"
    />
    <StatDisplay
      label="HEAT"
      value={4}
      bg="bg-su-pink"
      valueColor="text-su-white"
      borderColor="border-su-pink"
    />
  </div>
)

export const IsOverMax: Story = () => (
  <div className="flex gap-3">
    <StatDisplay label="SP" value={10} max={8} isOverMax />
    <StatDisplay label="EP" value={8} max={6} isOverMax />
  </div>
)

export const WithHoverText: Story = () => (
  <div className="flex gap-3">
    <StatDisplay label="SP" value={8} hoverText="Structure Points: The mech's health" />
    <StatDisplay label="EP" value={6} hoverText="Energy Points: Used to activate systems" />
  </div>
)

/* --- Box, edit mode (the former StatControl): +/- stepper column --- */
export const EditSteppers: Story = () => (
  <div className="flex gap-3">
    <StatDisplay label="SP" value={5} max={8} mode="edit" onChange={() => {}} />
    <StatDisplay label="EP" value={3} max={6} mode="edit" onChange={() => {}} bottomLabel="MAX" />
  </div>
)

/* --- Horizontal (the former ValueDisplay): black/white [label | value] --- */
export const Horizontal: Story = () => (
  <div className="flex flex-col items-start gap-2">
    <StatDisplay label="RANGE" value="Close" orientation="horizontal" />
    <StatDisplay label="TL" value={3} orientation="horizontal" />
    <StatDisplay label="TRAIT" value="Reliable" orientation="horizontal" inverse />
  </div>
)

/* --- Framed tracker (the former StatBlock): dots pip track --- */
export const Tracker: Story = () => (
  <div className="flex items-start gap-3">
    <StatDisplay label="SP" value={4} max={6} dots tone="sp" unit="Structure" />
    <StatDisplay label="AP" value={6} max={8} dots tone="ap" />
    <StatDisplay label="HP" value={7} max={10} dots tone="hp" name="Hit Points" />
  </div>
)

/* --- Tracker, editable: internal steppers + click-to-set pips --- */
export const TrackerEditable: Story = () => (
  <div className="flex items-start gap-3">
    <StatDisplay label="HEAT" value={4} max={6} dots tone="heat" onChange={() => {}} />
    <StatDisplay label="SP" value={3} max={8} dots tone="sp" onChange={() => {}} />
  </div>
)

/* --- Tracker, sm (rail / NPC strip) --- */
export const TrackerSm: Story = () => (
  <div className="flex items-start gap-3">
    <StatDisplay label="SP" value={2} max={4} dots tone="sp" size="sm" />
    <StatDisplay label="HP" value={5} max={6} dots tone="hp" size="sm" />
  </div>
)

/* --- Tracker, tri-state bay tally --- */
export const TrackerStates: Story = () => (
  <div className="flex items-start gap-3">
    <StatDisplay
      label="BAYS"
      states={['intact', 'intact', 'damaged', 'destroyed', 'intact']}
      unit="Crawler Bays"
    />
  </div>
)
