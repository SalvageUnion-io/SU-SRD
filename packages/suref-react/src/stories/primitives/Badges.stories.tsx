import type { Story } from '@ladle/react'
import type { ReactNode } from 'react'
import { Chip, Pill } from '../../components/chrome/Pill'
import type { PillTone } from '../../components/chrome/Pill'
import { MChip, Spec } from '../../components/chrome/MChip'
import { StatusBadge } from '../../components/chrome/StatusBadge'
import type { EntityStatus } from '../../components/chrome/StatusBadge'
import { Tag } from '../../components/chrome/Tag'

// biome-ignore lint/style/useComponentExportOnlyModules: Ladle stories require a default meta export alongside story components
export default {
  title: 'Primitives/Badges',
}

/** Tiny caption above each variant cluster so the catalog stays scannable. */
function ClusterLabel({ children }: { children: ReactNode }) {
  return (
    <div className="mb-1 mt-4 font-cond text-[10px] font-bold uppercase tracking-wider text-ink-2">
      {children}
    </div>
  )
}

function Row({ children }: { children: ReactNode }) {
  return <div className="flex flex-wrap items-start gap-3">{children}</div>
}

const PILL_TONES: PillTone[] = ['pilot', 'mech', 'crawler', 'ok', 'warn', 'bad']
const STATUSES: EntityStatus[] = ['intact', 'damaged', 'destroyed']

export const Pills: Story = () => (
  <div className="bg-paper p-4">
    <ClusterLabel>Default (ink-on-paper outline)</ClusterLabel>
    <Row>
      <Pill>Legal Starting</Pill>
      <Pill>Tech 3</Pill>
    </Row>

    <ClusterLabel>Every tone</ClusterLabel>
    <Row>
      {PILL_TONES.map((tone) => (
        <Pill key={tone} tone={tone}>
          {tone}
        </Pill>
      ))}
    </Row>

    <ClusterLabel>Rounded (poster app-bar kindpill)</ClusterLabel>
    <Row>
      <Pill rounded>Default</Pill>
      {PILL_TONES.map((tone) => (
        <Pill key={tone} tone={tone} rounded>
          {tone}
        </Pill>
      ))}
    </Row>
  </div>
)

export const Chips: Story = () => (
  <div className="bg-paper p-4">
    <ClusterLabel>Without value (borderless stat chip)</ClusterLabel>
    <Row>
      <Chip>Overheated</Chip>
      <Chip>Prone</Chip>
      <Chip>Grappled</Chip>
    </Row>

    <ClusterLabel>With value (bold inverse-emphasis)</ClusterLabel>
    <Row>
      <Chip value={12}>HP</Chip>
      <Chip value={6}>SP</Chip>
      <Chip value={4}>EP</Chip>
      <Chip value={3}>Heat</Chip>
      <Chip value="2/6">Cargo</Chip>
    </Row>
  </div>
)

export const Tags: Story = () => (
  <div className="bg-paper p-4">
    <ClusterLabel>Label only (stamped ink chip)</ClusterLabel>
    <Row>
      <Tag label="Turn Action" />
      <Tag label="Passive" />
      <Tag label="Ballistic" />
    </Row>

    <ClusterLabel>Value (inverted value box after label)</ClusterLabel>
    <Row>
      <Tag label="Range" value="Close" />
      <Tag label="Damage" value="[2]" />
      <Tag label="Heat" value={1} />
    </Row>

    <ClusterLabel>Pre (value before label)</ClusterLabel>
    <Row>
      <Tag label="AP" value="[1]" pre />
      <Tag label="EP" value={2} pre />
    </Row>

    <ClusterLabel>Ghost (inverted paper chip, inset ring)</ClusterLabel>
    <Row>
      <Tag label="Turn Action" ghost />
      <Tag label="Passive" ghost />
      <Tag label="Range" value="Medium" ghost />
      <Tag label="AP" value="[1]" pre ghost />
    </Row>
  </div>
)

export const StatusBadges: Story = () => (
  <div className="bg-paper p-4">
    <ClusterLabel>All states (static span)</ClusterLabel>
    <Row>
      {STATUSES.map((status) => (
        <StatusBadge key={status} status={status} />
      ))}
    </Row>

    <ClusterLabel>Clickable (cycle handler, with subject)</ClusterLabel>
    <Row>
      {STATUSES.map((status) => (
        <StatusBadge key={status} status={status} subject="Iron Mongrel" onClick={() => {}} />
      ))}
    </Row>
  </div>
)

export const MChips: Story = () => (
  <div className="bg-paper p-4">
    <ClusterLabel>MChip — default</ClusterLabel>
    <Row>
      <MChip label="Class" value="Roughneck" />
      <MChip label="Motto" value="Never Salvage Alone" />
    </Row>

    <ClusterLabel>MChip — call (16px nowrap callsign)</ClusterLabel>
    <Row>
      <MChip label="Callsign" value='"Wrench"' variant="call" />
    </Row>

    <ClusterLabel>MChip — class (13px ink-2)</ClusterLabel>
    <Row>
      <MChip label="Keywords" value="Ballistic" variant="class" />
    </Row>

    <ClusterLabel>Spec — chassis lozenge</ClusterLabel>
    <Row>
      <Spec label="SV" value={4} />
      <Spec label="HP" value={12} max={12} />
      <Spec label="EP" value={6} max={6} />
    </Row>

    <ClusterLabel>Spec — cargo (deep bronze recolor)</ClusterLabel>
    <Row>
      <Spec label="Cargo" value={2} max={6} cargo />
    </Row>
  </div>
)
