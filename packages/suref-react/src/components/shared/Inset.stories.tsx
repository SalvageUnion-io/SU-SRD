import type { Story } from '@ladle/react'
import type { ReactNode } from 'react'
import { SalvageUnionReference } from 'salvageunion-reference'
import { Inset } from './Inset'
import { StatDisplay } from './StatDisplay'
import { Btn } from '../chrome/Btn'
import { VitalGauge } from '../stat/VitalGauge'

// biome-ignore lint/style/useComponentExportOnlyModules: Ladle stories require a default meta export alongside story components
export default {
  title: 'Containers/Inset',
}

// A real Crawler type names the economy inset. The crew lead's name / keepsake /
// motto are freeform player content (no reference entity backs a crew lead), so
// they stay evocative literals — the SRD crew role + tags are real terms.
const crawlerName = SalvageUnionReference.Crawlers.all()[0]?.name ?? 'Union Crawler'

// Each story frames the primitive with the rule it embodies, then renders the
// Inset the way ITUN actually mounts it — inside a parent card's expand slot.
function Stage({ rule, children }: { rule: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-4 bg-wk-bg p-5 font-mono text-ink">
      <p className="max-w-2xl text-xs leading-relaxed text-ink-2">{rule}</p>
      <div className="max-w-md">{children}</div>
    </div>
  )
}

/** One economy lozenge: caption, big numeral, optional rust action control. */
function Loz({ label, value, action }: { label: string; value: number; action?: ReactNode }) {
  return (
    <div className="flex min-h-[64px] flex-col items-center justify-center gap-1 rounded-card border-2 border-ink bg-paper px-1.5 py-2 text-center">
      <span className="font-cond text-label font-bold uppercase leading-none tracking-caps text-ink-2">
        {label}
      </span>
      <span className="font-cond text-2xl font-bold leading-none tabular-nums text-ink">
        {value}
      </span>
      {action}
    </div>
  )
}

/**
 * CREW-LEAD inset — the crawler-bay crew lead (rules C11): a crawler-pink CREW
 * tag + the lead's name over a 4-HP tracker beside a quiet keepsake/motto
 * readout. Crew leads are 4 HP.
 */
export const CrewLead: Story = () => (
  <Stage rule="An Inset sits inside a parent card's expand slot. Crawler-pink CREW tag + name on the ink head bar; the SRD crew role rides the right edge; body pairs a 4-HP tracker (crew leads are 4 HP) with a quiet keepsake/motto dl.">
    <Inset
      tone="crawler"
      tag="Crew"
      label="Ace"
      headRight={
        <span className="font-cond text-micro uppercase leading-none tracking-caps text-paper/60">
          Greaser
        </span>
      }
      bodyClassName="flex flex-wrap items-start gap-3"
    >
      <StatDisplay pips label="HP" size="sm" tone="hp" max={4} value={3} />
      <dl className="m-0 min-w-0 flex-1 space-y-1.5">
        <div className="flex items-baseline gap-1.5">
          <dt className="shrink-0 font-cond text-micro font-bold uppercase leading-none tracking-caps text-ink">
            Keepsake
          </dt>
          <dd className="m-0 min-w-0 font-body text-note leading-snug text-ink-2">
            A cracked brass compass
          </dd>
        </div>
        <div className="flex items-baseline gap-1.5">
          <dt className="shrink-0 font-cond text-micro font-bold uppercase leading-none tracking-caps text-ink">
            Motto
          </dt>
          <dd className="m-0 min-w-0 font-body text-note leading-snug text-ink-2">
            Never strand the crew.
          </dd>
        </div>
      </dl>
    </Inset>
  </Stage>
)

/**
 * ECONOMY inset — the crawler economy frame: an SP VitalGauge over a lozenge
 * grid. `Pay`/`Fund` are true action controls, so they wear THE rust action
 * colour (Btn `primary`); the read-only Tech / Crew lozenges do not.
 */
export const Economy: Story = () => (
  <Stage
    rule={`The crawler economy frame as an Inset. SP VitalGauge (${crawlerName}, SP 20/20) over the Tech/Upkeep/Upgrade/Crew lozenge grid. Rust lands ONLY on the true action controls — Pay and Fund.`}
  >
    {/* sheet--crawler resolves --tone / --tone-deep so the gauge fills pink,
        exactly as a live crawler sheet mounts it. */}
    <div className="sheet--crawler">
      <Inset tone="crawler" tag="Econ" label={crawlerName} bodyClassName="flex flex-col gap-3">
        <VitalGauge label="SP" value={20} max={20} caption={['Current', 'Max']} />
        <div className="grid grid-cols-[repeat(auto-fit,minmax(92px,1fr))] gap-2.5">
          <Loz label="Tech" value={1} />
          <Loz
            label="Upkeep"
            value={5}
            action={
              <Btn variant="primary" size="sm">
                Pay
              </Btn>
            }
          />
          <Loz
            label="Upgrade"
            value={30}
            action={
              <Btn variant="primary" size="sm">
                Fund
              </Btn>
            }
          />
          <Loz label="Crew" value={3} />
        </div>
      </Inset>
    </div>
  </Stage>
)
