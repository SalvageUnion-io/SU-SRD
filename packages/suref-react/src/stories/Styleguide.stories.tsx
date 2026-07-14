import type { Story } from '@ladle/react'
import { Text } from '../components/base/Text'
import { statBlockRowStarts } from '../components/stat/pipRows'
import { cn } from '../utils/cn'

// biome-ignore lint/style/useComponentExportOnlyModules: Ladle stories require a default meta export alongside story components
export default {
  title: 'Styleguide',
}

/* ── module-local helpers (NOT stories) ─────────────────────────────────── */

const PIP = 'h-3 w-3 rounded-[2px] border-chrome border-ink'

type SectionProps = {
  title: string
  intro?: string
  children: React.ReactNode
}

function Section({ title, intro, children }: SectionProps) {
  return (
    <div className="bg-paper p-6 font-mono text-ink">
      <Text as="span" variant="pseudoheader" className="text-base">
        {title}
      </Text>
      {intro ? <p className="mt-3 max-w-2xl text-sm leading-relaxed text-ink-2">{intro}</p> : null}
      <div className="mt-5">{children}</div>
    </div>
  )
}

type LawProps = {
  rule: string
  detail: string
  example: React.ReactNode
}

function Law({ rule, detail, example }: LawProps) {
  return (
    <li className="flex items-start gap-4 border-b border-ink/12 py-4 last:border-b-0">
      <div className="min-w-0 flex-1">
        <div className="text-sm font-bold">{rule}</div>
        <div className="mt-1 text-sm text-ink-2">{detail}</div>
      </div>
      <div className="flex min-h-10 shrink-0 items-center justify-end">{example}</div>
    </li>
  )
}

type SwatchProps = {
  className: string
  token: string
  desc: string
  textClass?: string
}

function Swatch({ className, token, desc, textClass = 'text-paper' }: SwatchProps) {
  return (
    <div className="flex w-40 flex-col gap-1">
      <div
        className={cn(
          'flex h-16 items-end rounded-[3px] border border-ink p-1.5',
          className,
          textClass
        )}
      >
        <span className="text-[10px] font-bold">{className}</span>
      </div>
      <div className="text-xs font-bold">{token}</div>
      <div className="text-[11px] text-ink-2">{desc}</div>
    </div>
  )
}

/* ── 1. Guiding laws ────────────────────────────────────────────────────── */

export const GuidingLaws: Story = () => (
  <Section
    title="Guiding Laws"
    intro="One canonical language. These are the laws every surface (suref-web, in-the-union-now, suref-react) conforms to — no more legacy vs canon."
  >
    <ul className="max-w-3xl list-none p-0">
      <Law
        rule="The ink Stamp is the one label atom"
        detail="Every label / header is the ink pseudoheader. There is exactly one label primitive — nothing else names a thing."
        example={
          <Text as="span" variant="pseudoheader">
            Stamp
          </Text>
        }
      />
      <Law
        rule="One paper"
        detail="Reading surfaces are the system white #fbfaf7 — not pure white, not cream. Pure white survives only inside stamps and the value cell."
        example={
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-[2px] border border-ink bg-paper text-[9px]">
              paper
            </span>
            <span className="flex h-8 w-8 items-center justify-center rounded-[2px] border border-ink bg-su-white text-[9px]">
              white
            </span>
          </div>
        }
      />
      <Law
        rule="One action colour = rust"
        detail="Hue encodes ontology. Rust (#a85222) is the single action colour; state is a treatment overlay (redline / strike / X), never a second hue."
        example={<span className="h-8 w-16 rounded-[2px] border border-ink bg-rust" />}
      />
      <Law
        rule="Warm state palette"
        detail="Off stock Material: ok #6f8a4a, warn #c07a2f, bad #b0432b. No gradients."
        example={
          <div className="flex gap-1.5">
            <span className="h-8 w-8 rounded-[2px] border border-ink bg-status-ok" />
            <span className="h-8 w-8 rounded-[2px] border border-ink bg-status-warn" />
            <span className="h-8 w-8 rounded-[2px] border border-ink bg-status-bad" />
          </div>
        }
      />
      <Law
        rule="Border weight is a token"
        detail="One meaning per weight — entity / rail / pill / chrome / hairline — holding in both the light sheet and the dark instrument. Never border-[1.5px]."
        example={
          <div className="flex items-end gap-2">
            <span className="h-8 w-8 rounded-[2px] border border-ink" />
            <span className="h-8 w-8 rounded-[2px] border-chrome border-ink" />
            <span className="h-8 w-8 rounded-[2px] border-rail border-ink" />
            <span className="h-8 w-8 rounded-[2px] border-entity border-ink" />
          </div>
        }
      />
      <Law
        rule="Balanced pip-row split"
        detail="Gauges + statblocks split a track into balanced rows (max ~5–6 per row). 6 → 3+3, 8 → 4+4, 10 → 5+5."
        example={
          <div className="flex flex-col items-end gap-1">
            {statBlockRowStarts(8).map((row) => (
              <div key={row.start} className="flex gap-1">
                {Array.from({ length: row.count }, (_, i) => (
                  // biome-ignore lint/suspicious/noArrayIndexKey: pips are positional — the index IS their identity
                  <span key={row.start + i} className={PIP} />
                ))}
              </div>
            ))}
          </div>
        }
      />
      <Law
        rule="Caps tracking 0.04em on labels"
        detail="tracking-caps-tight (0.04em) is the canonical Stamp / label tracking. A ladder above it exists for eyebrows and wide caps."
        example={
          <span className="font-cond text-sm font-bold uppercase tracking-caps-tight">
            0.04em label
          </span>
        }
      />
    </ul>
  </Section>
)

/* ── 2. Palette ─────────────────────────────────────────────────────────── */

export const Palette: Story = () => (
  <Section
    title="Palette"
    intro="Ink, one paper, one action colour, and the warm state trio. Hue encodes ontology; the entity tones are the three ontologies."
  >
    <div className="space-y-6">
      <div>
        <div className="mb-2 text-xs font-bold uppercase tracking-caps-tight text-ink-2">
          Ink &amp; Paper
        </div>
        <div className="flex flex-wrap gap-4">
          <Swatch
            className="bg-paper"
            token="--color-paper"
            desc="System white #fbfaf7 · reading surface"
            textClass="text-ink"
          />
          <Swatch
            className="bg-su-white"
            token="--color-su-white"
            desc="Pure white · stamps + value cells only"
            textClass="text-ink"
          />
          <Swatch className="bg-ink" token="--color-ink" desc="Primary ink #282019" />
          <Swatch className="bg-ink-2" token="--color-ink-2" desc="Secondary ink #463d31" />
        </div>
      </div>

      <div>
        <div className="mb-2 text-xs font-bold uppercase tracking-caps-tight text-ink-2">
          Action
        </div>
        <div className="flex flex-wrap gap-4">
          <Swatch
            className="bg-rust"
            token="--color-rust"
            desc="THE single action colour #a85222"
          />
          <Swatch className="bg-rust-hi" token="--color-rust-hi" desc="Action hover #8a4019" />
          <Swatch className="bg-danger" token="--color-danger" desc="Danger button #9a4633" />
        </div>
      </div>

      <div>
        <div className="mb-2 text-xs font-bold uppercase tracking-caps-tight text-ink-2">
          State trio (warm)
        </div>
        <div className="flex flex-wrap gap-4">
          <Swatch className="bg-status-ok" token="--color-status-ok" desc="Intact #6f8a4a" />
          <Swatch className="bg-status-warn" token="--color-status-warn" desc="Damaged #c07a2f" />
          <Swatch className="bg-status-bad" token="--color-status-bad" desc="Destroyed #b0432b" />
        </div>
        <p className="mt-2 max-w-2xl text-xs text-ink-2">
          Roll-tier outcome colours are Discord-bot-only; the web never colours roll outcomes.
        </p>
      </div>

      <div>
        <div className="mb-2 text-xs font-bold uppercase tracking-caps-tight text-ink-2">
          Entity tones (ontology)
        </div>
        <div className="flex flex-wrap gap-4">
          <Swatch
            className="bg-pilot"
            token="--color-pilot"
            desc="Pilot (orange)"
            textClass="text-ink"
          />
          <Swatch
            className="bg-mech"
            token="--color-mech"
            desc="Mech (green)"
            textClass="text-ink"
          />
          <Swatch
            className="bg-crawler"
            token="--color-crawler"
            desc="Crawler (pink)"
            textClass="text-ink"
          />
        </div>
      </div>
    </div>
  </Section>
)

/* ── 3. Borders ─────────────────────────────────────────────────────────── */

type BorderSampleProps = {
  className: string
  name: string
  spec: string
}

function BorderSample({ className, name, spec }: BorderSampleProps) {
  return (
    <div className="flex w-44 flex-col gap-2">
      <div className={cn('h-16 rounded-[3px] bg-su-white', className)} />
      <div className="text-xs font-bold">{name}</div>
      <div className="text-[11px] text-ink-2">{spec}</div>
    </div>
  )
}

export const Borders: Story = () => (
  <Section
    title="Borders"
    intro="Five weights, one meaning each. Only the non-native weights get a utility — hairline is native `border`, pill is native `border-2`."
  >
    <div className="flex flex-wrap gap-6">
      <BorderSample
        className="border border-ink"
        name="hairline"
        spec="`border` · 1px · pips, rows, ghosts"
      />
      <BorderSample
        className="border-chrome border-ink"
        name="chrome"
        spec="`border-chrome` · 1.5px · buttons, inputs, panels"
      />
      <BorderSample
        className="border-2 border-ink"
        name="pill"
        spec="`border-2` · 2px · pills, badges, dividers"
      />
      <BorderSample
        className="border-rail border-ink"
        name="rail"
        spec="`border-rail` · 2.5px · rail cards, Hold frames"
      />
      <BorderSample
        className="border-entity border-ink"
        name="entity"
        spec="`border-entity` · 3px · entity cards, hero header"
      />
    </div>
  </Section>
)

/* ── 4. Tracking ────────────────────────────────────────────────────────── */

type TrackSampleProps = {
  className: string
  name: string
  value: string
}

function TrackSample({ className, name, value }: TrackSampleProps) {
  return (
    <div className="border-b border-ink/12 py-3 last:border-b-0">
      <div className={cn('font-cond text-lg font-bold uppercase', className)}>Salvage Union</div>
      <div className="mt-1 text-xs text-ink-2">
        <span className="font-bold text-ink">{name}</span> · {value}
      </div>
    </div>
  )
}

export const Tracking: Story = () => (
  <Section
    title="Tracking"
    intro="The caps-tracking ladder. tracking-caps-tight (0.04em) is the label default; the wider steps are for eyebrows and spaced caps."
  >
    <div className="max-w-md">
      <TrackSample
        className="tracking-caps-tight"
        name="tracking-caps-tight"
        value="0.04em — the label / Stamp default"
      />
      <TrackSample className="tracking-caps-snug" name="tracking-caps-snug" value="0.06em" />
      <TrackSample className="tracking-caps" name="tracking-caps" value="0.08em" />
      <TrackSample className="tracking-caps-wide" name="tracking-caps-wide" value="0.12em" />
      <TrackSample className="tracking-eyebrow" name="tracking-eyebrow" value="0.22em — eyebrows" />
    </div>
  </Section>
)

/* ── 5. The Stamp ───────────────────────────────────────────────────────── */

export const TheStamp: Story = () => (
  <Section
    title="The Stamp"
    intro="The ink Stamp is the one label / header atom (base/Text pseudoheader). It can sit on paper, ride a border line (StampSeam), or invert."
  >
    <div className="space-y-8">
      <div>
        <div className="mb-2 text-xs font-bold uppercase tracking-caps-tight text-ink-2">
          On paper
        </div>
        <Text as="span" variant="pseudoheader">
          Salvage Pattern
        </Text>
      </div>

      <div>
        <div className="mb-2 text-xs font-bold uppercase tracking-caps-tight text-ink-2">
          StampSeam — riding a border line
        </div>
        <div className="relative rounded-[3px] border-rail border-ink bg-su-white px-4 pb-4 pt-5">
          <span className="absolute -top-[11px] left-3">
            <Text as="span" variant="pseudoheader">
              Systems
            </Text>
          </span>
          <p className="text-sm text-ink-2">
            The stamp is self-height-centred on the frame's border, never pinned with a fixed
            negative margin.
          </p>
        </div>
      </div>

      <div>
        <div className="mb-2 text-xs font-bold uppercase tracking-caps-tight text-ink-2">
          Inverse
        </div>
        <span className="inline-block bg-ink p-3">
          <Text as="span" variant="pseudoheaderInverse">
            Inverse Stamp
          </Text>
        </span>
      </div>
    </div>
  </Section>
)

/* ── 6. Pip split ───────────────────────────────────────────────────────── */

type PipRowsProps = {
  max: number
  label: string
}

function PipRows({ max, label }: PipRowsProps) {
  const rows = statBlockRowStarts(max)
  return (
    <div className="flex w-40 flex-col gap-2">
      <div className="flex flex-col gap-1">
        {rows.map((row) => (
          <div key={row.start} className="flex gap-1">
            {Array.from({ length: row.count }, (_, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: pips are positional — the index IS their identity
              <span key={row.start + i} className={PIP} />
            ))}
          </div>
        ))}
      </div>
      <div className="text-xs font-bold">
        max = {max} <span className="font-normal text-ink-2">({label})</span>
      </div>
    </div>
  )
}

export const PipSplit: Story = () => (
  <Section
    title="Pip Split"
    intro="Gauge + statblock tracks split into balanced rows via statBlockRowStarts — the real algorithm, not hand-faked layout."
  >
    <div className="flex flex-wrap gap-8">
      <PipRows max={6} label="3+3" />
      <PipRows max={8} label="4+4" />
      <PipRows max={10} label="5+5" />
      <PipRows max={13} label="4/4/5" />
    </div>
  </Section>
)

/* ── 7. Rendering matrix ────────────────────────────────────────────────── */

type MatrixRow = {
  kind: string
  context: string
  primitive: string
  rule: string
}

const matrixRows: MatrixRow[] = [
  {
    kind: 'Bounded stat',
    context: 'non-interactive',
    primitive: 'StatDisplay dots (read)',
    rule: 'Framed tracker, pip track read-only.',
  },
  {
    kind: 'Bounded stat',
    context: 'interactive',
    primitive: 'StatDisplay dots + mode="edit"',
    rule: 'Numeral + steppers; pips click-to-set.',
  },
  {
    kind: 'Label | value',
    context: 'inline pair',
    primitive: 'StatDisplay orientation="horizontal"',
    rule: 'The black/white [label | value] chip.',
  },
  {
    kind: 'Heat at a glance',
    context: 'condensed inline',
    primitive: 'StatDisplay inline chip / VitalGauge',
    rule: '[label · pips · value]; heat tone overlay.',
  },
  {
    kind: 'Segmented capacity bar',
    context: 'sheet / instrument',
    primitive: 'VitalGauge',
    rule: 'Unit bar; skin="sheet" or "instrument".',
  },
]

export const RenderingMatrix: Story = () => (
  <Section
    title="Rendering Matrix"
    intro="Kind × context → one primitive + rule. This is the decision table for which primitive renders a given shape of data."
  >
    <div className="overflow-x-auto">
      <table className="w-full min-w-[42rem] border-collapse text-sm">
        <thead>
          <tr className="border-b-2 border-ink text-left">
            <th className="p-2 text-xs font-bold uppercase tracking-caps-tight">Kind</th>
            <th className="p-2 text-xs font-bold uppercase tracking-caps-tight">Context</th>
            <th className="p-2 text-xs font-bold uppercase tracking-caps-tight">Primitive</th>
            <th className="p-2 text-xs font-bold uppercase tracking-caps-tight">Rule</th>
          </tr>
        </thead>
        <tbody>
          {matrixRows.map((row) => (
            <tr key={`${row.kind}-${row.context}`} className="border-b border-ink/12 align-top">
              <td className="p-2 font-bold">{row.kind}</td>
              <td className="p-2 text-ink-2">{row.context}</td>
              <td className="p-2">
                <code className="rounded-[2px] bg-ink/8 px-1 py-0.5 text-[12px]">
                  {row.primitive}
                </code>
              </td>
              <td className="p-2 text-ink-2">{row.rule}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </Section>
)

/* ── 8. Known deviations ────────────────────────────────────────────────── */

const deviations: string[] = [
  'FilterChip is off the chrome token system — styles on the su-* palette (bg-su-black / su-orange focus) instead of ink/paper/rust + ring-rust/25. Reconcile in the Btn merge.',
  'Two status vocabularies — Pill ok/warn/bad vs StatusBadge intact/damaged/destroyed both resolve to status-ok/warn/bad. One naming.',
  'Tag ghost ring is a raw rgba(40,32,25,0.2) inset shadow, not an ink token.',
  'Arbitrary radii across the badge / chrome families (rounded-[2px]/[3px]/[5px]/[6px], rounded-full) with no shared radius token.',
  'Arbitrary spacing / font sizes (px-[9px], text-[11px], text-[9.5px]…) not on a scale; Input focus uses ring-rust/[0.22]; Slab dashed is a hand-rolled repeating-linear-gradient.',
]

export const KnownDeviations: Story = () => (
  <Section
    title="Known Deviations"
    intro="Off-system spots surfaced by the primitive catalog — the backlog the merges will fix. Listed here so nothing ships as a silent surprise."
  >
    <ul className="max-w-3xl list-none space-y-3 p-0">
      {deviations.map((item) => (
        <li key={item} className="flex items-start gap-3">
          <span
            aria-hidden
            className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-[2px] border-chrome border-ink text-xs font-bold text-rust"
          >
            ☐
          </span>
          <span className="text-sm text-ink-2">{item}</span>
        </li>
      ))}
    </ul>
  </Section>
)
