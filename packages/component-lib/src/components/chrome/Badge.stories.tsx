import type { Story } from '@ladle/react'
import type { ReactNode } from 'react'
import { SalvageUnionReference } from 'salvageunion-reference'
import { Caption } from '../../stories/_harness'
import { Badge, type BadgeTone } from './Badge'

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

// One real, proper-cased label per Badge tone so every tone still renders.
const TONE_LABELS: Record<BadgeTone, string> = {
  pilot: pilotLabel,
  mech: chassisName,
  crawler: crawlerName,
  ok: 'Intact',
  warn: 'Damaged',
  bad: 'Destroyed',
}

function Row({ children }: { children: ReactNode }) {
  return <div className="flex flex-wrap items-start gap-3">{children}</div>
}

const BADGE_TONES: BadgeTone[] = ['pilot', 'mech', 'crawler', 'ok', 'warn', 'bad']

/**
 * The unified `Badge` — Pill / Chip are named presets over this one
 * implementation (ruleset §6). Badges are LABEL-ONLY: a label+value readout is a
 * Stat (`Stat orientation="horizontal"`), never a badge (value-cell law).
 */
export const Unified: Story = () => (
  <div className="flex flex-col gap-4">
    <div>
      <Caption>surface · solid / ghost / outline / quiet</Caption>
      <Row>
        <Badge surface="solid">{keywordTags[0]}</Badge>
        <Badge surface="ghost">{economyTags[0]}</Badge>
        <Badge surface="outline">{economyTags[1]}</Badge>
        <Badge surface="quiet">Uses</Badge>
      </Row>
    </div>
    <div>
      <Caption>surface=tone · entity-kind + status fills</Caption>
      <Row>
        {BADGE_TONES.map((tone) => (
          <Badge key={tone} surface="tone" tone={tone}>
            {TONE_LABELS[tone]}
          </Badge>
        ))}
      </Row>
    </div>
    <div>
      <Caption>surface=outline · the former Pill (ink-on-paper)</Caption>
      <Row>
        <Badge surface="outline">Legal Starting</Badge>
        <Badge surface="outline">{techLabel}</Badge>
      </Row>
    </div>
  </div>
)

// A keyword is a SINGLE stamped Badge (solid, the default). Split label/value
// content is a Stat, not a Badge — render it with Stat orientation="horizontal".
export const Keywords: Story = () => (
  <div className="flex flex-col gap-4">
    <div>
      <Caption>Keyword (stamped ink chip)</Caption>
      <Row>
        {keywordTags.map((keyword) => (
          <Badge key={keyword}>{keyword}</Badge>
        ))}
      </Row>
    </div>
    <div>
      <Caption>Ghost (inverted paper chip, inset ring)</Caption>
      <Row>
        {economyTags.map((economy) => (
          <Badge key={economy} surface="ghost">
            {economy}
          </Badge>
        ))}
      </Row>
    </div>
  </div>
)

// The SQUARE stamp shape (shape="stamp") — the ink label/header/tab/eyebrow atom
// (the former Stamp). Sizes, plates, and the seam that rides a container's border.
export const Stamps: Story = () => (
  <div className="flex flex-col gap-4">
    <div>
      <Caption>surface — on-ink (default) / inverse / on-tone</Caption>
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
    </div>
    <div>
      <Caption>size — sm / md (default) / lg</Caption>
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
    </div>
    <div>
      <Caption>seam — rides the container's top border</Caption>
      <div className="relative mt-2 rounded-card border-2 border-ink bg-paper p-4">
        <Badge shape="stamp" seam className="left-3">
          Systems
        </Badge>
        <p className="m-0 font-body text-sm text-ink-2">
          A framed body; the stamp straddles the top border.
        </p>
      </div>
    </div>
  </div>
)
