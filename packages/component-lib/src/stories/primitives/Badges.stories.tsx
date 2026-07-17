import type { Story } from '@ladle/react'
import type { ReactNode } from 'react'
import { SalvageUnionReference } from 'salvageunion-reference'
import { Chip, Pill } from '../../components/chrome/Pill'
import type { PillTone } from '../../components/chrome/Pill'
import { StatusBadge } from '../../components/chrome/StatusBadge'
import type { EntityStatus } from '../../components/chrome/StatusBadge'
import { Badge, type BadgeTone } from '../../components/chrome/Badge'

// biome-ignore lint/style/useComponentExportOnlyModules: Ladle stories require a default meta export alongside story components
export default {
  title: 'Atoms/Badge',
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
    <div className="mb-1 mt-4 font-cond text-label uppercase tracking-caps text-wk-muted">
      {children}
    </div>
  )
}

function Row({ children }: { children: ReactNode }) {
  return <div className="flex flex-wrap items-start gap-3">{children}</div>
}

const PILL_TONES: PillTone[] = ['pilot', 'mech', 'crawler', 'ok', 'warn', 'bad']
const STATUSES: EntityStatus[] = ['intact', 'damaged', 'destroyed']
const BADGE_TONES: BadgeTone[] = ['pilot', 'mech', 'crawler', 'ok', 'warn', 'bad']

/**
 * The unified `Badge` — Pill / Chip are named presets over this one
 * implementation (ruleset §6). Badges are LABEL-ONLY: a label+value readout is a
 * Stat (`Stat orientation="horizontal"`), never a badge (value-cell law).
 */
export const Unified: Story = () => (
  <div className="bg-paper p-4">
    <ClusterLabel>surface · solid / ghost / outline / quiet</ClusterLabel>
    <Row>
      <Badge surface="solid">{keywordTags[0]}</Badge>
      <Badge surface="ghost">{economyTags[0]}</Badge>
      <Badge surface="outline">{economyTags[1]}</Badge>
      <Badge surface="quiet">Uses</Badge>
    </Row>
    <ClusterLabel>surface=tone · entity-kind + status fills</ClusterLabel>
    <Row>
      {BADGE_TONES.map((tone) => (
        <Badge key={tone} surface="tone" tone={tone}>
          {PILL_TONE_LABELS[tone]}
        </Badge>
      ))}
    </Row>
  </div>
)

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

// A keyword is a SINGLE stamped Badge (solid, the default). Split label/value
// content is a Stat, not a Badge — render it with Stat orientation="horizontal".
export const Keywords: Story = () => (
  <div className="bg-paper p-4">
    <ClusterLabel>Keyword (stamped ink chip)</ClusterLabel>
    <Row>
      {keywordTags.map((keyword) => (
        <Badge key={keyword}>{keyword}</Badge>
      ))}
    </Row>

    <ClusterLabel>Ghost (inverted paper chip, inset ring)</ClusterLabel>
    <Row>
      {economyTags.map((economy) => (
        <Badge key={economy} surface="ghost">
          {economy}
        </Badge>
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

// The SQUARE stamp shape (shape="stamp") — the ink label/header/tab/eyebrow atom
// (the former Stamp). Sizes, plates, and the seam that rides a container's border.
export const Stamps: Story = () => (
  <div className="bg-paper p-4">
    <ClusterLabel>surface — on-ink (default) / inverse / on-tone</ClusterLabel>
    <Row>
      <Badge shape="stamp">{chassisName}</Badge>
      <Badge shape="stamp" surface="inverse">
        Structure
      </Badge>
      <span className="inline-block bg-su-green px-2 py-1">
        <Badge shape="stamp" surface="on-tone">
          On tone
        </Badge>
      </span>
    </Row>

    <ClusterLabel>size — sm / md (default) / lg</ClusterLabel>
    <Row>
      <Badge shape="stamp" size="sm">
        SP
      </Badge>
      <Badge shape="stamp" size="md">
        {techLabel}
      </Badge>
      <Badge shape="stamp" size="lg">
        {chassisName}
      </Badge>
    </Row>

    <ClusterLabel>seam — rides the container's top border</ClusterLabel>
    <div className="relative mt-2 rounded-card border-2 border-ink bg-paper p-4">
      <Badge shape="stamp" seam className="left-3">
        Systems
      </Badge>
      <p className="m-0 font-body text-sm text-ink-2">
        A framed body; the stamp straddles the top border.
      </p>
    </div>
  </div>
)
