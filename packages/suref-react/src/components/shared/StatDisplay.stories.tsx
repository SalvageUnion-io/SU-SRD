import type { Story } from '@ladle/react'
import { SalvageUnionReference } from 'salvageunion-reference'
import { StatDisplay, type StatState } from './StatDisplay'

// biome-ignore lint/style/useComponentExportOnlyModules: Ladle stories require a default meta export alongside story components
export default {
  title: 'Atoms/StatDisplay',
}

// Real SRD content drives every anatomy below (reference data is preloaded by
// .ladle/components.tsx before this chunk imports).
const chassis = SalvageUnionReference.Chassis.all()[0]
const sp = chassis?.structurePoints ?? 12
const ep = chassis?.energyPoints ?? 4
const heat = chassis?.heatCapacity ?? 6
const tl = chassis?.techLevel ?? 1

// A real weapon action supplies a real range + trait keyword for the horizontal split-stat.
const weaponAction = SalvageUnionReference.Actions.all()[0]
const rangeLabel = weaponAction?.range?.[0] ?? 'Close'
const traitLabel = weaponAction?.traits?.[0]?.type ?? 'ballistic'

// Real crawler bays supply the tri-state bay tally.
const bayStatePattern: StatState[] = ['intact', 'intact', 'damaged', 'destroyed', 'intact']
const crawlerBays = SalvageUnionReference.CrawlerBays.all().slice(0, 5)
const bayStates: StatState[] =
  crawlerBays.length > 0
    ? crawlerBays.map((_, i) => bayStatePattern[i % bayStatePattern.length] ?? 'intact')
    : bayStatePattern

export const Default: Story = () => (
  <div className="flex gap-3">
    <StatDisplay label="SP" value={sp} />
    <StatDisplay label="EP" value={ep} />
    <StatDisplay label="HEAT" value={heat} />
  </div>
)

export const WithOutOfMax: Story = () => (
  <div className="flex gap-3">
    <StatDisplay label="SP" value={Math.ceil(sp * 0.5)} max={sp} />
    <StatDisplay label="EP" value={Math.ceil(ep * 0.5)} max={ep} />
    <StatDisplay label="HEAT" value={Math.ceil(heat / 3)} max={heat} />
  </div>
)

export const Compact: Story = () => (
  <div className="flex gap-2">
    <StatDisplay label="SP" value={sp} compact />
    <StatDisplay label="EP" value={ep} compact />
    <StatDisplay label="HEAT" value={0} compact />
  </div>
)

export const Disabled: Story = () => (
  <div className="flex gap-3">
    <StatDisplay label="SP" value={sp} disabled />
    <StatDisplay label="EP" value={ep} disabled />
  </div>
)

export const Inverse: Story = () => (
  <div className="flex gap-3">
    <StatDisplay label="SP" value={sp} inverse />
    <StatDisplay label="EP" value={ep} inverse />
  </div>
)

export const Clickable: Story = () => (
  <div className="flex gap-3">
    <StatDisplay label="SP" value={sp} onClick={() => alert('Clicked SP!')} bottomLabel="MAX" />
    <StatDisplay label="EP" value={ep} onClick={() => alert('Clicked EP!')} bottomLabel="MAX" />
  </div>
)

export const CustomColors: Story = () => (
  <div className="flex gap-3">
    <StatDisplay
      label="SP"
      value={sp}
      bg="bg-su-green"
      valueColor="text-paper"
      borderColor="border-su-green"
    />
    <StatDisplay
      label="EP"
      value={ep}
      bg="bg-su-orange"
      valueColor="text-paper"
      borderColor="border-su-orange"
    />
    <StatDisplay
      label="HEAT"
      value={heat}
      bg="bg-su-pink"
      valueColor="text-paper"
      borderColor="border-su-pink"
    />
  </div>
)

export const IsOverMax: Story = () => (
  <div className="flex gap-3">
    <StatDisplay label="SP" value={sp + 2} max={sp} isOverMax />
    <StatDisplay label="EP" value={ep + 2} max={ep} isOverMax />
  </div>
)

export const WithHoverText: Story = () => (
  <div className="flex gap-3">
    <StatDisplay label="SP" value={sp} hoverText="Structure Points: The mech's health" />
    <StatDisplay label="EP" value={ep} hoverText="Energy Points: Used to activate systems" />
  </div>
)

/* --- Box, edit mode (the former StatControl): +/- stepper column --- */
export const EditSteppers: Story = () => (
  <div className="flex gap-3">
    <StatDisplay label="SP" value={Math.ceil(sp * 0.5)} max={sp} mode="edit" onChange={() => {}} />
    <StatDisplay
      label="EP"
      value={Math.ceil(ep * 0.5)}
      max={ep}
      mode="edit"
      onChange={() => {}}
      bottomLabel="MAX"
    />
  </div>
)

/* --- Horizontal (the former ValueDisplay): black/white [label | value] --- */
export const Horizontal: Story = () => (
  <div className="flex flex-col items-start gap-2">
    <StatDisplay label="RANGE" value={rangeLabel} orientation="horizontal" />
    <StatDisplay label="TL" value={tl} orientation="horizontal" />
    <StatDisplay label="TRAIT" value={traitLabel} orientation="horizontal" inverse />
  </div>
)

/* --- Framed tracker (the former StatBlock): pips pip track --- */
export const Tracker: Story = () => (
  <div className="flex items-start gap-3">
    <StatDisplay label="SP" value={Math.ceil(sp * 0.5)} max={sp} pips tone="sp" unit="Structure" />
    <StatDisplay label="EP" value={Math.ceil(ep * 0.75)} max={ep} pips tone="ap" />
    <StatDisplay
      label="HEAT"
      value={Math.ceil(heat / 2)}
      max={heat}
      pips
      tone="heat"
      name="Heat Capacity"
    />
  </div>
)

/* --- Tracker, editable: internal steppers + click-to-set pips --- */
export const TrackerEditable: Story = () => (
  <div className="flex items-start gap-3">
    <StatDisplay
      label="HEAT"
      value={Math.ceil(heat / 2)}
      max={heat}
      pips
      tone="heat"
      onChange={() => {}}
    />
    <StatDisplay label="SP" value={Math.ceil(sp / 3)} max={sp} pips tone="sp" onChange={() => {}} />
  </div>
)

/* --- Tracker, sm (rail / NPC strip) --- */
export const TrackerSm: Story = () => (
  <div className="flex items-start gap-3">
    <StatDisplay label="EP" value={Math.ceil(ep / 2)} max={ep} pips tone="sp" size="sm" />
    <StatDisplay label="HEAT" value={Math.ceil(heat * 0.8)} max={heat} pips tone="hp" size="sm" />
  </div>
)

/* --- Tracker, tri-state bay tally --- */
export const TrackerStates: Story = () => (
  <div className="flex items-start gap-3">
    <StatDisplay label="BAYS" states={bayStates} unit="Crawler Bays" />
  </div>
)
