import type { CSSProperties, ReactNode } from 'react'
import { SalvageUnionReference } from 'salvageunion-reference'
import { color, font, fontSize, space, tracking, weight } from '../../design/tokens'
import type { Story } from '../../stories/_harness'
import { Button } from '../atoms/Button'
import { Stat } from '../atoms/Stat'
import { VitalGauge } from '../atoms/VitalGauge'
import { Inset } from './Inset'

export default {
  title: 'Containers/Inset',
}

// A real Crawler type names the economy inset. The crew lead's name / keepsake /
// motto are freeform player content (no reference entity backs a crew lead), so
// they stay evocative literals — the SRD crew role + tags are real terms.
const crawlerName = SalvageUnionReference.Crawlers.all()[0]?.name ?? 'Union Crawler'

// Each story frames the primitive with the rule it embodies, then renders the
// Inset the way ITUN actually mounts it — inside a parent card's expand slot.
const STAGE = {
  display: 'flex',
  flexDirection: 'column',
  gap: space[16],
  backgroundColor: color.wkBg,
  padding: space[20],
  fontFamily: font.body,
  color: color.ink,
} satisfies CSSProperties

const RULE = {
  maxWidth: '42rem',
  fontSize: fontSize.xs,
  lineHeight: 1.625,
  color: color.wkMuted,
} satisfies CSSProperties

const CAPS = {
  fontFamily: font.cond,
  fontSize: fontSize.badge,
  textTransform: 'uppercase',
  lineHeight: 1,
  letterSpacing: tracking.caps,
} satisfies CSSProperties

const ROLE = { ...CAPS, color: color.paper60 } satisfies CSSProperties

const TERM = {
  ...CAPS,
  flexShrink: 0,
  fontWeight: weight.bold,
  color: color.ink,
} satisfies CSSProperties

const DEFINITION = {
  margin: 0,
  minWidth: 0,
  fontFamily: font.body,
  fontSize: fontSize.note,
  lineHeight: 1.375,
  color: color.wkMuted,
} satisfies CSSProperties

const ENTRY = { display: 'flex', alignItems: 'baseline', gap: space[6] } satisfies CSSProperties

function Stage({ rule, children }: { rule: string; children: ReactNode }) {
  return (
    <div style={STAGE}>
      <p style={RULE}>{rule}</p>
      <div style={{ maxWidth: '28rem' }}>{children}</div>
    </div>
  )
}

/** One economy readout, the way `CrawlerEconFrame` renders it: a Stat value
 * box + optional rust action control (ruleset §3.7 — never hand-assembled). */
function Loz({ label, value, action }: { label: string; value: number; action?: ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: space[4] }}>
      <Stat size="full" label={label} value={value} />
      {action}
    </div>
  )
}

/**
 * CREW-LEAD inset — the crawler-bay crew lead: a crawler-pink CREW
 * tag + the lead's name over a 4-HP tracker beside a quiet keepsake/motto
 * readout. Crew leads are 4 HP.
 */
export const CrewLead: Story = () => (
  <Stage rule="An Inset sits inside a parent card's expand slot. Crawler-pink CREW tag + name on the ink head bar; the SRD crew role rides the right edge; body pairs a 4-HP tracker (crew leads are 4 HP) with a quiet keepsake/motto dl.">
    <Inset
      tone="crawler"
      tag="Crew"
      label="Ace"
      headRight={<span style={ROLE}>Greaser</span>}
      bodyStyle={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-start', gap: space[12] }}
    >
      <Stat label="HP" value={3} max={4} size="mini" />
      <dl
        style={{
          margin: 0,
          minWidth: 0,
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          gap: space[6],
        }}
      >
        <div style={ENTRY}>
          <dt style={TERM}>Keepsake</dt>
          <dd style={DEFINITION}>A cracked brass compass</dd>
        </div>
        <div style={ENTRY}>
          <dt style={TERM}>Motto</dt>
          <dd style={DEFINITION}>Never strand the crew.</dd>
        </div>
      </dl>
    </Inset>
  </Stage>
)

/**
 * ECONOMY inset — the crawler economy frame: an SP VitalGauge over a lozenge
 * grid. `Pay`/`Fund` are true action controls, so they wear THE rust action
 * colour (Button `primary`); the read-only Tech / Crew lozenges do not.
 */
export const Economy: Story = () => (
  <Stage
    rule={`The crawler economy frame as an Inset. SP VitalGauge (${crawlerName}, SP 20/20) over the Tech/Upkeep/Upgrade/Crew lozenge grid. Rust lands ONLY on the true action controls — Pay and Fund.`}
  >
    {/* sheet--crawler resolves --tone / --tone-deep so the gauge fills pink,
        exactly as a live crawler sheet mounts it. */}
    <div className="sheet--crawler">
      <Inset
        tone="crawler"
        tag="Econ"
        label={crawlerName}
        bodyStyle={{ display: 'flex', flexDirection: 'column', gap: space[12] }}
      >
        <VitalGauge label="SP" value={20} max={20} />
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(92px, 1fr))',
            gap: space[10],
          }}
        >
          <Loz label="Tech" value={1} />
          <Loz
            label="Upkeep"
            value={5}
            action={
              <Button variant="primary" size="mini">
                Pay
              </Button>
            }
          />
          <Loz
            label="Upgrade"
            value={30}
            action={
              <Button variant="primary" size="mini">
                Fund
              </Button>
            }
          />
          <Loz label="Crew" value={3} />
        </div>
      </Inset>
    </div>
  </Stage>
)
