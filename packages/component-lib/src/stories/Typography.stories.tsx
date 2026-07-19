import type { Story } from '@ladle/react'
import type { ReactNode } from 'react'
import { SalvageUnionReference } from 'salvageunion-reference'
import { Text } from '../components/base/Text'
import { Caption } from './_harness'

// biome-ignore lint/style/useComponentExportOnlyModules: Ladle stories require a default meta export alongside story components
export default {
  title: 'Foundations/Typography',
}

// Specimens are driven by real SRD copy (preloaded by .ladle/components.tsx);
// where a literal is needed we use a real game term, never lorem.
const chassis = SalvageUnionReference.Chassis.all()[0]
const system = SalvageUnionReference.Systems.all()[0]
const equipment = SalvageUnionReference.Equipment.all()[0]

const specimenName = (chassis?.name ?? 'Iron Mongrel').toUpperCase()
const specimenBody =
  [chassis, system, equipment]
    .map((e) => (e && 'description' in e ? e.description : undefined))
    .find((d): d is string => typeof d === 'string' && d.length > 0) ??
  'Salvage what you can carry, break down what you cannot, and keep the Mech running.'

// ── Token tables (kept 1:1 with theme.css + ruleset.md §4.2) ──────────────────

/** The ONE font-size ladder (theme.css `--text-*`). Never `text-[Npx]` for these. */
const SCALE: { cls: string; token: string; px: string; use: string }[] = [
  {
    cls: 'text-nano',
    token: '--text-nano',
    px: '8px',
    use: 'smallest markers — TL glyphs, unit suffixes',
  },
  {
    cls: 'text-micro',
    token: '--text-micro',
    px: '9px',
    use: 'dense caps meta labels (NPC insets, encounter cards)',
  },
  {
    cls: 'text-label',
    token: '--text-label',
    px: '10px',
    use: 'standard uppercase font-cond field / section label',
  },
  {
    cls: 'text-label-lg',
    token: '--text-label-lg',
    px: '10.5px',
    use: 'pseudoheader / rail caps label',
  },
  {
    cls: 'text-badge',
    token: '--text-badge',
    px: '11px',
    use: 'badges, pills, compact caps values',
  },
  {
    cls: 'text-note',
    token: '--text-note',
    px: '11.5px',
    use: 'small body copy in rails and insets',
  },
  {
    cls: 'text-caption',
    token: '--text-caption',
    px: '13px',
    use: 'small body copy — hints, empty states, subtitles',
  },
  {
    cls: 'text-lede',
    token: '--text-lede',
    px: '15px',
    use: 'emphasized inline values, inset titles',
  },
]

/** The three families (theme.css `--font-*`). */
const FONTS: { cls: string; token: string; name: string; use: string }[] = [
  {
    cls: 'font-body',
    token: '--font-body',
    name: 'Barlow',
    use: 'body copy, values, default running text (the preferred alias)',
  },
  {
    cls: 'font-cond',
    token: '--font-cond',
    name: 'Barlow Semi Condensed',
    use: 'stamps, labels, titles, tabs — all-caps chrome',
  },
  {
    cls: 'font-mono',
    token: '--font-mono',
    name: 'Barlow (legacy alias — NOT monospace)',
    use: 'existing usage only; new code uses font-body',
  },
]

/** Three tracking values, down from 15 (ruleset §4.2). */
const TRACKING: { cls: string; token: string; value: string; use: string }[] = [
  {
    cls: 'tracking-label',
    token: '--tracking-label',
    value: '0.04em',
    use: 'every stamp / label / tab',
  },
  {
    cls: 'tracking-display',
    token: '--tracking-display',
    value: '0.01em',
    use: 'titles ≥ 22px + buttons',
  },
  {
    cls: 'tracking-eyebrow',
    token: '--tracking-eyebrow',
    value: '0.22em',
    use: 'brand caption only',
  },
]

/** The `Text` component's variant roles (components/base/Text.tsx). */
const ROLES: {
  variant: 'default' | 'body' | 'hint' | 'flavor' | 'pseudoheader' | 'pseudoheaderInverse'
  use: string
  sample: string
}[] = [
  { variant: 'default', use: 'default running text — values, inline copy', sample: specimenBody },
  { variant: 'body', use: 'entity body prose — descriptions, rules text', sample: specimenBody },
  {
    variant: 'hint',
    use: 'centered italic hint — empty states, helper text',
    sample: 'No systems installed yet.',
  },
  {
    variant: 'flavor',
    use: 'italic flavor — secondary ink, ability flavor lines',
    sample: specimenBody,
  },
  {
    variant: 'pseudoheader',
    use: 'ink-on-paper caps header block (the stamp treatment)',
    sample: specimenName,
  },
  { variant: 'pseudoheaderInverse', use: 'paper-on-ink caps header block', sample: specimenName },
]

// ── Layout helpers ────────────────────────────────────────────────────────────

/** A specimen row: the live rendering on the left, its spec meta on the right. */
function Row({
  specimen,
  name,
  meta,
  use,
}: {
  specimen: ReactNode
  name: string
  meta: string
  use: string
}) {
  return (
    <div className="flex flex-wrap items-baseline gap-x-6 gap-y-1 border-t border-ink/12 py-3">
      <div className="min-w-[16rem] flex-1">{specimen}</div>
      <div className="flex min-w-[18rem] flex-1 flex-col gap-0.5">
        <span className="font-cond text-badge uppercase tracking-caps-tight text-ink">
          {name}
          <span className="ml-2 font-body text-nano normal-case tracking-normal text-ink-2">
            {meta}
          </span>
        </span>
        <span className="font-body text-caption text-ink-2">{use}</span>
      </div>
    </div>
  )
}

function Section({
  title,
  blurb,
  children,
}: {
  title: string
  blurb: string
  children: ReactNode
}) {
  return (
    <section className="mt-8">
      <Caption>{title}</Caption>
      <p className="mb-2 max-w-3xl font-body text-caption text-ink-2">{blurb}</p>
      {children}
    </section>
  )
}

// ── Stories ───────────────────────────────────────────────────────────────────

/** The one font-size ladder, each step rendered at true size. */
export const Scale: Story = () => (
  <Section
    title="Type scale — the one font-size ladder"
    blurb="theme.css --text-nano … --text-lede. Use these tokens (text-nano … text-lede); never an arbitrary text-[Npx] for a step on this ladder."
  >
    {SCALE.map((s) => (
      <Row
        key={s.cls}
        specimen={
          <span className={`${s.cls} font-cond uppercase tracking-caps-tight text-ink`}>
            {specimenName}
          </span>
        }
        name={s.cls}
        meta={`${s.token} · ${s.px}`}
        use={s.use}
      />
    ))}
  </Section>
)

/** The three font families. */
export const Fonts: Story = () => (
  <Section
    title="Font families"
    blurb="Two faces: Barlow (body/values) and Barlow Semi Condensed (all-caps chrome). font-mono is a legacy alias for Barlow — it is NOT monospaced; new code uses font-body."
  >
    {FONTS.map((f) => (
      <Row
        key={f.cls}
        specimen={
          <span className={`${f.cls} text-lede text-ink`}>
            {specimenName} · {specimenName.toLowerCase()}
          </span>
        }
        name={f.cls}
        meta={`${f.token} · ${f.name}`}
        use={f.use}
      />
    ))}
  </Section>
)

/** The three tracking tokens. */
export const Tracking: Story = () => (
  <Section
    title="Tracking — three values, down from fifteen"
    blurb="ruleset §4.2. The wide instrument-HUD stamps conform down to --tracking-label. (tracking-caps / tracking-caps-tight are the common utility aliases in use across the cards.)"
  >
    {TRACKING.map((t) => (
      <Row
        key={t.cls}
        specimen={
          <span className={`${t.cls} font-cond text-lede uppercase text-ink`}>{specimenName}</span>
        }
        name={t.cls}
        meta={`${t.token} · ${t.value}`}
        use={t.use}
      />
    ))}
  </Section>
)

/** The Text component's variant roles — when to reach for which. */
export const Roles: Story = () => (
  <Section
    title="Text roles — the variant vocabulary"
    blurb="components/base/Text.tsx. Reach for the role by intent, not by hand-styling: the same six roles read consistently on every surface."
  >
    {ROLES.map((r) => (
      <Row
        key={r.variant}
        specimen={<Text variant={r.variant}>{r.sample}</Text>}
        name={`Text variant="${r.variant}"`}
        meta=""
        use={r.use}
      />
    ))}
  </Section>
)
