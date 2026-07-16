import type { Story } from '@ladle/react'
import { useState } from 'react'
import { StatDisplay } from './StatDisplay'

// biome-ignore lint/style/useComponentExportOnlyModules: Ladle stories require a default meta export alongside story components
export default {
  title: 'NEW/Stat Atoms',
}

/** A titled demo row on the paper ground the cards use. */
function Row({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <code className="font-mono text-nano text-ink-2 uppercase tracking-wide">{title}</code>
      <div className="flex flex-wrap items-start gap-3">{children}</div>
    </div>
  )
}

/**
 * The two stat shapes after the atom refactor:
 *  - VERTICAL (Full): the boxed value with full (optionally two-line) labels.
 *  - HORIZONTAL (Compact): the inline `[label|value]` cell with SHORTFORM labels.
 * Each shape has a read-only form and an edit form (the +/- stepper column).
 */
export const Shapes: Story = () => (
  <div className="flex flex-col gap-8 bg-paper p-6">
    <Row title="Vertical (Full) · read-only">
      <StatDisplay label="Tech" bottomLabel="Level" value={3} />
      <StatDisplay label="Structure" bottomLabel="Points" value={15} />
      <StatDisplay label="Energy" bottomLabel="Points" value={10} />
      <StatDisplay label="Salvage" bottomLabel="Value" value={2} />
    </Row>
    <Row title="Horizontal (Compact) · read-only · shortform labels">
      <StatDisplay orientation="horizontal" label="TL" value={3} compact />
      <StatDisplay orientation="horizontal" label="SP" value={15} compact />
      <StatDisplay orientation="horizontal" label="EP" value={10} compact />
      <StatDisplay orientation="horizontal" label="SV" value={2} compact />
      <StatDisplay orientation="horizontal" label="Heat" value={6} compact />
    </Row>
  </div>
)

/** The edit forms — the box grows a vertical stepper column; the compact cell
 *  grows the horizontal peer (the "compact stat with steppers"). */
export const EditSteppers: Story = () => {
  const [sp, setSp] = useState(9)
  const [ep, setEp] = useState(6)
  const [heat, setHeat] = useState(4)
  return (
    <div className="flex flex-col gap-8 bg-paper p-6">
      <Row title="Vertical (Full) · editable">
        <StatDisplay label="SP" value={sp} max={13} mode="edit" onChange={setSp} />
        <StatDisplay label="EP" value={ep} max={11} mode="edit" onChange={setEp} />
        <StatDisplay label="Heat" value={heat} max={12} mode="edit" onChange={setHeat} />
      </Row>
      <Row title="Horizontal (Compact) · editable · the new compact-with-steppers">
        <StatDisplay
          orientation="horizontal"
          label="SP"
          value={sp}
          max={13}
          compact
          mode="edit"
          onChange={setSp}
        />
        <StatDisplay
          orientation="horizontal"
          label="EP"
          value={ep}
          max={11}
          compact
          mode="edit"
          onChange={setEp}
        />
        <StatDisplay
          orientation="horizontal"
          label="Heat"
          value={heat}
          max={12}
          compact
          mode="edit"
          onChange={setHeat}
        />
      </Row>
    </div>
  )
}

/** How a full mech's stats read as a compact header cluster — always TWO rows,
 *  columns = ceil(count/2). Eight stats → 2 rows of 4 (the top-right axis on a
 *  compact/nested card). */
export const CompactHeaderCluster: Story = () => (
  <div className="bg-paper p-6">
    <code className="mb-2 block font-mono text-nano text-ink-2 uppercase tracking-wide">
      Compact header cluster · 8 stats → 2 rows of 4
    </code>
    <div
      className="grid w-fit justify-items-end gap-1"
      style={{ gridTemplateColumns: 'repeat(4, max-content)' }}
    >
      <StatDisplay orientation="horizontal" label="TL" value={3} compact />
      <StatDisplay orientation="horizontal" label="SP" value={15} compact />
      <StatDisplay orientation="horizontal" label="EP" value={8} compact />
      <StatDisplay orientation="horizontal" label="SV" value={2} compact />
      <StatDisplay orientation="horizontal" label="Sys" value={7} compact />
      <StatDisplay orientation="horizontal" label="Mod" value={2} compact />
      <StatDisplay orientation="horizontal" label="Cargo" value={3} compact />
      <StatDisplay orientation="horizontal" label="Heat" value={6} compact />
    </div>
  </div>
)
