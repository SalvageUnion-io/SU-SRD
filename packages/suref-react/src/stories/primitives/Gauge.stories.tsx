import type { Story } from '@ladle/react'
import { SalvageUnionReference } from 'salvageunion-reference'

import { VitalGauge } from '../../components/stat/VitalGauge'

// biome-ignore lint/style/useComponentExportOnlyModules: Ladle stories require a default meta export alongside story components
export default {
  title: 'Atoms/VitalGauge',
}

const noop = () => {}

// Real chassis stats drive every gauge below (reference data is preloaded by
// .ladle/components.tsx before this chunk imports).
const chassis = SalvageUnionReference.Chassis.all()[0]
const chassisName = chassis?.name ?? 'Chassis'
const sp = chassis?.structurePoints ?? 12
const ep = chassis?.energyPoints ?? 4
const heat = chassis?.heatCapacity ?? 6
const cargo = chassis?.cargoCapacity ?? 16

/** Read-only static gauge — non-interactive read-out (role="img"). */
export const ReadOnly: Story = () => (
  <div className="bg-paper p-4">
    <div className="mb-1 font-cond text-[10px] uppercase tracking-caps text-wk-muted">
      read-only static · {chassisName}
    </div>
    <div className="sheet--pilot max-w-sm">
      <VitalGauge label="EP" value={Math.ceil(ep / 2)} max={ep} readOnly />
    </div>
  </div>
)

/** Editable gauge — click a segment / arrow-key the group (onChange no-op here). */
export const Editable: Story = () => (
  <div className="bg-paper p-4">
    <div className="mb-1 font-cond text-[10px] uppercase tracking-caps text-wk-muted">
      editable (onChange no-op) · {chassisName}
    </div>
    <div className="sheet--mech max-w-sm">
      <VitalGauge label="Heat" value={Math.ceil(heat / 2)} max={heat} onChange={noop} />
    </div>
  </div>
)

/** Dense sizing — auto-on at max ≥ 12 (h-18, gap-3). */
export const Dense: Story = () => (
  <div className="bg-paper p-4">
    <div className="mb-1 font-cond text-[10px] uppercase tracking-caps text-wk-muted">
      dense (max ≥ 12) · {chassisName}
    </div>
    <div className="sheet--crawler max-w-md">
      <VitalGauge label="Cargo" value={Math.ceil(cargo * 0.7)} max={cargo} onChange={noop} />
    </div>
  </div>
)

/** Danger redline — first danger segment index reads status-bad when lit. */
export const Danger: Story = () => (
  <div className="bg-paper p-4">
    <div className="mb-1 font-cond text-[10px] uppercase tracking-caps text-wk-muted">
      with danger redline · {chassisName}
    </div>
    <div className="sheet--mech max-w-sm">
      <VitalGauge
        label="Heat"
        value={heat - 1}
        max={heat}
        danger={Math.max(1, heat - 2)}
        onChange={noop}
      />
    </div>
  </div>
)

/** Custom caption pair — right-aligned under the track (defaults to Current / Max). */
export const WithCaption: Story = () => (
  <div className="bg-paper p-4">
    <div className="mb-1 font-cond text-[10px] uppercase tracking-caps text-wk-muted">
      with a caption pair · {chassisName}
    </div>
    <div className="sheet--crawler max-w-sm">
      <VitalGauge
        label="Cargo"
        value={Math.ceil(cargo * 0.6)}
        max={cargo}
        caption={['Stowed', 'Bays']}
        onChange={noop}
      />
    </div>
  </div>
)

/** Sub-label — muted stamp-adjacent note (e.g. mech-frame 'Structure'). */
export const WithSubLabel: Story = () => (
  <div className="bg-paper p-4">
    <div className="mb-1 font-cond text-[10px] uppercase tracking-caps text-wk-muted">
      with subLabel · {chassisName}
    </div>
    <div className="sheet--mech max-w-sm">
      <VitalGauge
        label="SP"
        subLabel="Structure"
        value={Math.ceil(sp * 0.75)}
        max={sp}
        onChange={noop}
      />
    </div>
  </div>
)

/** Overridden max — hand-pinned cap (overriddenFrom + revert-to-derived; both no-op). */
export const OverriddenMax: Story = () => (
  <div className="bg-paper p-4">
    <div className="mb-1 font-cond text-[10px] uppercase tracking-caps text-wk-muted">
      overridden max (from derived) · {chassisName}
    </div>
    <div className="sheet--pilot max-w-sm">
      <VitalGauge
        label="SP"
        value={Math.ceil(sp * 0.7)}
        max={sp + 2}
        onChange={noop}
        onMaxChange={noop}
        overriddenFrom={sp}
        onRevertOverride={noop}
      />
    </div>
  </div>
)
