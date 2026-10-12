import type { CSSProperties, ReactNode } from 'react'
import { useState } from 'react'
import { SalvageUnionReference } from 'salvageunion-reference'
import { borderWidth, color, font, fontSize, radius, space } from '../../design/tokens'
import type { Story } from '../../stories/_harness'
import { Caption } from '../../stories/_harness'
import type { BadgeTone } from './Badge'
import { Badge } from './Badge'

export default {
  title: 'Atoms/Badge',
}

// Real SRD content — reference data is preloaded by catalog.tsx before
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
  // The Salvage Union term for the person running the table — the role a Game
  // row's badge actually carries.
  game: 'Mediator',
  ok: 'Intact',
  warn: 'Damaged',
  bad: 'Destroyed',
}

const STACK = { display: 'flex', flexDirection: 'column', gap: space[16] } satisfies CSSProperties

const ROW = {
  alignItems: 'flex-start',
  display: 'flex',
  flexWrap: 'wrap',
  gap: space[12],
} satisfies CSSProperties

/** A mech-tone ground for the `on-tone` stamp. */
const TONE_GROUND = {
  backgroundColor: color.mech,
  display: 'inline-block',
  paddingBlock: space[4],
  paddingInline: space[8],
} satisfies CSSProperties

/** A framed body for the seam stamp to straddle. */
const SEAM_FRAME = {
  backgroundColor: color.paper,
  borderColor: color.ink,
  borderRadius: radius.card,
  borderStyle: 'solid',
  borderWidth: borderWidth.pill,
  marginTop: space[8],
  padding: space[16],
  position: 'relative',
} satisfies CSSProperties

const SEAM_BODY = {
  color: color.wkMuted,
  fontFamily: font.body,
  fontSize: fontSize.sm,
  lineHeight: 'calc(1.25 / 0.875)',
  margin: 0,
} satisfies CSSProperties

function Row({ children }: { children: ReactNode }) {
  return <div style={ROW}>{children}</div>
}

const BADGE_TONES: BadgeTone[] = ['pilot', 'mech', 'crawler', 'game', 'ok', 'warn', 'bad']

/**
 * The unified `Badge` — one implementation, no named presets (ruleset §6). Badges are LABEL-ONLY: a label+value readout is a
 * Stat (`Stat orientation="horizontal"`), never a badge (value-cell law).
 */
export const Unified: Story = () => (
  <div style={STACK}>
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
      <Caption>surface=outline · ink-on-paper</Caption>
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
  <div style={STACK}>
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

// The interactive filter-chip rung (`as="button"`) — a Badge that toggles. The call site owns the pressed state: it drives
// `surface` (solid pressed / ghost unpressed) and passes `aria-pressed`, so the
// Badge stays presentational. `swatch` prefixes a colour swatch (tech-level
// filters). Numeric tiers carry the swatch; Bio/Nanite tint the active fill.
const TL_FILTERS = [1, 2, 3, 4, 5, 6] as const
function useToggleSet<T>() {
  const [set, setSet] = useState<Set<T>>(() => new Set())
  const toggle = (value: T) =>
    setSet((prev) => {
      const next = new Set(prev)
      if (next.has(value)) next.delete(value)
      else next.add(value)
      return next
    })
  return { set, toggle, clear: () => setSet(new Set()) }
}
export const Filter: Story = () => {
  const keywords = useToggleSet<string>()
  const tls = useToggleSet<number>()
  return (
    <div style={STACK}>
      <div>
        <Caption>plain toggle — solid when pressed, ghost when not</Caption>
        <Row>
          <Badge
            shape="chip"
            as="button"
            aria-pressed={keywords.set.size === 0}
            surface={keywords.set.size === 0 ? 'solid' : 'ghost'}
            onClick={keywords.clear}
          >
            All
          </Badge>
          {keywordTags.map((keyword) => (
            <Badge
              key={keyword}
              shape="chip"
              as="button"
              aria-pressed={keywords.set.has(keyword)}
              surface={keywords.set.has(keyword) ? 'solid' : 'ghost'}
              onClick={() => keywords.toggle(keyword)}
            >
              {keyword}
            </Badge>
          ))}
        </Row>
      </div>
      <div>
        <Caption>swatch — the tech-level filter chips</Caption>
        <Row>
          {TL_FILTERS.map((tl) => (
            <Badge
              key={tl}
              shape="chip"
              as="button"
              aria-pressed={tls.set.has(tl)}
              surface={tls.set.has(tl) ? 'solid' : 'ghost'}
              swatch={`var(--color-tl-${tl})`}
              onClick={() => tls.toggle(tl)}
            >
              {`TL${tl}`}
            </Badge>
          ))}
        </Row>
      </div>
    </div>
  )
}

// The SQUARE stamp shape (shape="stamp") — the ink label/header/tab/eyebrow
// atom. Sizes, plates, and the seam that rides a container's border.
export const Stamps: Story = () => (
  <div style={STACK}>
    <div>
      <Caption>surface — on-ink (default) / inverse / on-tone</Caption>
      <Row>
        <Badge shape="stamp">{chassisName}</Badge>
        <Badge shape="stamp" surface="inverse">
          Structure
        </Badge>
        <span style={TONE_GROUND}>
          <Badge shape="stamp" surface="on-tone">
            On tone
          </Badge>
        </span>
      </Row>
    </div>
    <div>
      <Caption>size — sm / md (default) / lg</Caption>
      <Row>
        <Badge shape="stamp" size="mini">
          SP
        </Badge>
        <Badge shape="stamp" size="compact">
          {techLabel}
        </Badge>
        <Badge shape="stamp" size="full">
          {chassisName}
        </Badge>
      </Row>
    </div>
    <div>
      <Caption>seam — rides the container's top border</Caption>
      <div style={SEAM_FRAME}>
        <Badge shape="stamp" seam style={{ left: space[12] }}>
          Systems
        </Badge>
        <p style={SEAM_BODY}>A framed body; the stamp straddles the top border.</p>
      </div>
    </div>
  </div>
)
