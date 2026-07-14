import type { Story } from '@ladle/react'

import { VitalGauge } from '../../components/stat/VitalGauge'

// biome-ignore lint/style/useComponentExportOnlyModules: Ladle stories require a default meta export alongside story components
export default {
  title: 'Primitives/VitalGauge',
}

const noop = () => {}

/** Read-only static gauge — non-interactive read-out (role="img"). */
export const ReadOnly: Story = () => (
  <div className="bg-paper p-4">
    <div className="mb-1 font-cond text-[10px] uppercase tracking-caps text-wk-muted">
      read-only static
    </div>
    <div className="sheet--pilot max-w-sm">
      <VitalGauge label="HP" value={7} max={10} readOnly />
    </div>
  </div>
)

/** Editable gauge — click a segment / arrow-key the group (onChange no-op here). */
export const Editable: Story = () => (
  <div className="bg-paper p-4">
    <div className="mb-1 font-cond text-[10px] uppercase tracking-caps text-wk-muted">
      editable (onChange no-op)
    </div>
    <div className="sheet--mech max-w-sm">
      <VitalGauge label="SP" value={4} max={8} onChange={noop} />
    </div>
  </div>
)

/** Dense sizing — auto-on at max ≥ 12 (h-18, gap-3). */
export const Dense: Story = () => (
  <div className="bg-paper p-4">
    <div className="mb-1 font-cond text-[10px] uppercase tracking-caps text-wk-muted">
      dense (max ≥ 12)
    </div>
    <div className="sheet--crawler max-w-md">
      <VitalGauge label="EP" value={11} max={16} onChange={noop} />
    </div>
  </div>
)

/** Danger redline — first danger segment index reads status-bad when lit. */
export const Danger: Story = () => (
  <div className="bg-paper p-4">
    <div className="mb-1 font-cond text-[10px] uppercase tracking-caps text-wk-muted">
      with danger redline
    </div>
    <div className="sheet--mech max-w-sm">
      <VitalGauge label="Heat" value={5} max={6} danger={4} onChange={noop} />
    </div>
  </div>
)

/** Custom caption pair — right-aligned under the track (defaults to Current / Max). */
export const WithCaption: Story = () => (
  <div className="bg-paper p-4">
    <div className="mb-1 font-cond text-[10px] uppercase tracking-caps text-wk-muted">
      with a caption pair
    </div>
    <div className="sheet--crawler max-w-sm">
      <VitalGauge label="Cargo" value={3} max={5} caption={['Stowed', 'Bays']} onChange={noop} />
    </div>
  </div>
)

/** Sub-label — muted stamp-adjacent note (e.g. mech-frame 'Structure'). */
export const WithSubLabel: Story = () => (
  <div className="bg-paper p-4">
    <div className="mb-1 font-cond text-[10px] uppercase tracking-caps text-wk-muted">
      with subLabel
    </div>
    <div className="sheet--mech max-w-sm">
      <VitalGauge label="HP" subLabel="Structure" value={9} max={12} onChange={noop} />
    </div>
  </div>
)

/** Overridden max — hand-pinned cap (overriddenFrom + revert-to-derived; both no-op). */
export const OverriddenMax: Story = () => (
  <div className="bg-paper p-4">
    <div className="mb-1 font-cond text-[10px] uppercase tracking-caps text-wk-muted">
      overridden max (from derived)
    </div>
    <div className="sheet--pilot max-w-sm">
      <VitalGauge
        label="HP"
        value={8}
        max={14}
        onChange={noop}
        onMaxChange={noop}
        overriddenFrom={10}
        onRevertOverride={noop}
      />
    </div>
  </div>
)
