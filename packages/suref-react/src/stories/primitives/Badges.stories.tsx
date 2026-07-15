import type { Story } from '@ladle/react'
import type { ReactNode } from 'react'
import { SalvageUnionReference } from 'salvageunion-reference'
import { Chip, Pill } from '../../components/chrome/Pill'
import type { PillTone } from '../../components/chrome/Pill'
import { StatusBadge } from '../../components/chrome/StatusBadge'
import type { EntityStatus } from '../../components/chrome/StatusBadge'
import { Tag } from '../../components/chrome/Tag'

// biome-ignore lint/style/useComponentExportOnlyModules: Ladle stories require a default meta export alongside story components
export default {
  title: 'Primitives/Badges',
}

// Real SRD content — reference data is preloaded by .ladle/components.tsx before
// any story chunk imports, so module-top-level access is safe here.
const chassis = SalvageUnionReference.Chassis.all()[0]
const traits = SalvageUnionReference.Traits.all()
const actions = SalvageUnionReference.Actions.all()
const classes = SalvageUnionReference.Classes.all()
const crawler = SalvageUnionReference.Crawlers.all()[0]

const chassisName = chassis?.name ?? 'Chassis'
const techLabel = `Tech ${chassis?.techLevel ?? 1}`

const pilotLabel = classes[0]?.name ?? 'Pilot'
const crawlerName = crawler?.name ?? 'Crawler'

const traitLabel = (name: string, fallback: string) =>
  traits.find((t) => t.name === name)?.name ?? fallback
const keywordTags = [
  traitLabel('armour', 'armour'),
  traitLabel('ballistic', 'ballistic'),
  traitLabel('explosive', 'explosive'),
]

const actionType = (type: string) => actions.find((a) => a.actionType === type)?.actionType ?? type
const economyTags = [`${actionType('Turn')} Action`, actionType('Passive'), actionType('Reaction')]

// Real Salvage Union condition vocabulary (rules keywords: prone / blind / irradiated / shutdown).
const activeConditions = ['Prone', 'Blind', 'Irradiated']

// One real, proper-cased label per Pill tone so every tone still renders.
const PILL_TONE_LABELS: Record<PillTone, string> = {
  pilot: pilotLabel,
  mech: chassisName,
  crawler: crawlerName,
  ok: 'Intact',
  warn: 'Damaged',
  bad: 'Destroyed',
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
      <Pill>{techLabel}</Pill>
    </Row>

    <ClusterLabel>Every tone</ClusterLabel>
    <Row>
      {PILL_TONES.map((tone) => (
        <Pill key={tone} tone={tone}>
          {PILL_TONE_LABELS[tone]}
        </Pill>
      ))}
    </Row>
  </div>
)

export const Chips: Story = () => (
  <div className="bg-paper p-4">
    <ClusterLabel>Keyword / status chips (borderless)</ClusterLabel>
    <Row>
      {activeConditions.map((condition) => (
        <Chip key={condition}>{condition}</Chip>
      ))}
    </Row>
  </div>
)

// Tag is a SINGLE keyword chip. Split label/value content is a Stat — render it
export const Tags: Story = () => (
  <div className="bg-paper p-4">
    <ClusterLabel>Keyword (stamped ink chip)</ClusterLabel>
    <Row>
      {keywordTags.map((keyword) => (
        <Tag key={keyword} label={keyword} />
      ))}
    </Row>

    <ClusterLabel>Ghost (inverted paper chip, inset ring)</ClusterLabel>
    <Row>
      {economyTags.map((economy) => (
        <Tag key={economy} label={economy} ghost />
      ))}
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
        <StatusBadge key={status} status={status} subject={chassisName} onClick={() => {}} />
      ))}
    </Row>
  </div>
)
