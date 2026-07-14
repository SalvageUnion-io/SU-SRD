import type { Story } from '@ladle/react'
import type { ReactNode } from 'react'
import { Chip, Pill } from '../../components/chrome/Pill'
import type { PillTone } from '../../components/chrome/Pill'
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

// Tag is a SINGLE keyword chip. Split label/value content is a Stat — render it
export const Tags: Story = () => (
  <div className="bg-paper p-4">
    <ClusterLabel>Keyword (stamped ink chip)</ClusterLabel>
    <Row>
      <Tag label="Turn Action" />
      <Tag label="Passive" />
      <Tag label="Ballistic" />
    </Row>

    <ClusterLabel>Ghost (inverted paper chip, inset ring)</ClusterLabel>
    <Row>
      <Tag label="Turn Action" ghost />
      <Tag label="Passive" ghost />
      <Tag label="Reaction" ghost />
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
