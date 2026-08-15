import type { Story } from '@ladle/react'
import type { CSSProperties, ReactNode } from 'react'
import { SalvageUnionReference } from 'salvageunion-reference'
import { Text } from '../components/base/Text'
import { color, font, fontSize, space, tracking } from '../design/tokens'
import { Caption } from './_harness'

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

// ── Token tables ─────────────────────────────────────────────────────────────
//
// Migrated off Tailwind in #799 (epic #802). Each table is now DERIVED from
// `design/tokens.ts` rather than restating a utility class beside a hand-typed
// pixel value, which is what component-lib/CLAUDE.md means by "specimens are
// generated from the tokens so they cannot drift". The `--su-*` custom-property
// name is spelled mechanically from the token key, exactly as
// `tokens.parity.test.ts` spells it, so this page cannot claim a property the
// stylesheet does not emit.

/** `fontSize.labelLg` → `--su-text-label-lg`. */
const cssVarName = (group: string, key: string) =>
  `--su-${group}-${key
    .replace(/([A-Z])/g, '-$1')
    .replace(/(\d+)$/, '-$1')
    .toLowerCase()}`

/**
 * The semantic rungs this page specimens — nano through lede, the ladder the
 * chrome actually spends. The display end (readout … hero) is shown on
 * Foundations/Theme, and the inherited Tailwind rungs are deliberately absent:
 * `tokens.ts` carries them only so a migrating call site does not re-size, and
 * a catalog page that specimened them would advertise the debt as a choice.
 */
const SCALE_RUNGS = [
  ['nano', 'smallest markers — TL glyphs, unit suffixes'],
  ['micro', 'dense caps meta labels (NPC insets, encounter cards)'],
  ['label', 'standard uppercase condensed field / section label'],
  ['labelLg', 'stamp / rail caps label'],
  ['badge', 'badges, pills, compact caps values'],
  ['note', 'small body copy in rails and insets'],
  ['caption', 'small body copy — hints, empty states, subtitles'],
  ['lede', 'emphasized inline values, inset titles'],
] as const satisfies readonly (readonly [keyof typeof fontSize, string])[]

/** The two faces. TWO, no aliases. */
const FONTS = [
  ['body', 'Barlow', 'body copy, values, default running text'],
  ['cond', 'Barlow Semi Condensed', 'stamps, labels, titles, tabs — all-caps chrome'],
] as const satisfies readonly (readonly [keyof typeof font, string, string])[]

/**
 * The caps tracking ladder.
 *
 * THIS TABLE WAS WRONG BEFORE #799, and the migration is what surfaced it. It
 * listed three rows — `--tracking-label` (0.04em), `--tracking-display`
 * (0.01em) and `--tracking-eyebrow` — of which only the last exists. Neither
 * `--tracking-label` nor `--tracking-display` is declared in `theme.css` or
 * anywhere else in the repo, and the `tracking-label` / `tracking-display`
 * utility classes the specimens rendered with had no definition to resolve, so
 * two of the three rows rendered at the browser's default tracking while
 * captioning a value they were not showing. (Foundations/Theme repeats the same
 * two names; that page is corrected in the same change.)
 *
 * The real ladder is five rungs, and it is the one `tokens.ts` and `theme.css`
 * agree on. Deriving the table from the token object is what stops this
 * recurring: a rung cannot be listed here unless it exists.
 */
const TRACKING_USE: Record<keyof typeof tracking, string> = {
  capsTight: 'the canonical stamp / label / tab tracking',
  capsSnug: 'section titles inside a panel',
  caps: 'captions and column headers',
  capsWide: 'the widest chrome rung — dense table headers',
  eyebrow: 'brand caption only',
}

/** The `Text` component's variant roles (components/base/Text.tsx). */
const ROLES: {
  variant: 'default' | 'body' | 'hint' | 'flavor'
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
]

// ── Layout helpers ────────────────────────────────────────────────────────────

const rowStyle = {
  alignItems: 'baseline',
  borderTop: `1px solid ${color.ink12}`,
  columnGap: space[24],
  display: 'flex',
  flexWrap: 'wrap',
  paddingBottom: space[12],
  paddingTop: space[12],
  rowGap: space[4],
} satisfies CSSProperties

const specimenNameStyle = {
  color: color.ink,
  fontFamily: font.cond,
  fontSize: fontSize.badge,
  letterSpacing: tracking.capsTight,
  textTransform: 'uppercase',
} satisfies CSSProperties

const metaStyle = {
  color: color.wkMuted,
  fontFamily: font.body,
  fontSize: fontSize.nano,
  letterSpacing: 'normal',
  marginLeft: space[8],
  textTransform: 'none',
} satisfies CSSProperties

const useStyle = {
  color: color.wkMuted,
  fontFamily: font.body,
  fontSize: fontSize.caption,
} satisfies CSSProperties

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
    <div style={rowStyle}>
      <div style={{ flex: 1, minWidth: '16rem' }}>{specimen}</div>
      <div
        style={{ display: 'flex', flex: 1, flexDirection: 'column', gap: '2px', minWidth: '18rem' }}
      >
        <span style={specimenNameStyle}>
          {name}
          <span style={metaStyle}>{meta}</span>
        </span>
        <span style={useStyle}>{use}</span>
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
    <section style={{ marginTop: space[32] }}>
      <Caption>{title}</Caption>
      <p style={{ ...useStyle, marginBottom: space[8], maxWidth: '48rem' }}>{blurb}</p>
      {children}
    </section>
  )
}

// ── Stories ───────────────────────────────────────────────────────────────────

/** The one font-size ladder, each step rendered at true size. */
export const Scale: Story = () => (
  <Section
    title="Type scale — the one font-size ladder"
    blurb="design/tokens.ts fontSize.nano … fontSize.lede, emitted as --su-text-nano … --su-text-lede. Reach for a rung by name; never an arbitrary pixel value for a step on this ladder."
  >
    {SCALE_RUNGS.map(([key, use]) => (
      <Row
        key={key}
        specimen={
          <span
            style={{
              color: color.ink,
              fontFamily: font.cond,
              fontSize: fontSize[key],
              letterSpacing: tracking.capsTight,
              textTransform: 'uppercase',
            }}
          >
            {specimenName}
          </span>
        }
        name={`fontSize.${key}`}
        meta={`${cssVarName('text', key)} · ${fontSize[key]}`}
        use={use}
      />
    ))}
  </Section>
)

/** The two font families. */
export const Fonts: Story = () => (
  <Section
    title="Font families"
    blurb="Two faces, no aliases: Barlow (body/values) and Barlow Semi Condensed (all-caps chrome)."
  >
    {FONTS.map(([key, name, use]) => (
      <Row
        key={key}
        specimen={
          <span style={{ color: color.ink, fontFamily: font[key], fontSize: fontSize.lede }}>
            {specimenName} · {specimenName.toLowerCase()}
          </span>
        }
        name={`font.${key}`}
        meta={`${cssVarName('font', key)} · ${name}`}
        use={use}
      />
    ))}
  </Section>
)

/** The caps tracking ladder — five rungs, every one of them real. */
export const Tracking: Story = () => (
  <Section
    title="Tracking — the caps ladder"
    blurb="design/tokens.ts tracking.capsTight … tracking.eyebrow. capsTight (0.04em) is the canonical stamp/label rung; eyebrow (0.22em) is the brand caption and nothing else."
  >
    {(Object.keys(tracking) as (keyof typeof tracking)[]).map((key) => (
      <Row
        key={key}
        specimen={
          <span
            style={{
              color: color.ink,
              fontFamily: font.cond,
              fontSize: fontSize.lede,
              letterSpacing: tracking[key],
              textTransform: 'uppercase',
            }}
          >
            {specimenName}
          </span>
        }
        name={`tracking.${key}`}
        meta={`${cssVarName('tracking', key)} · ${tracking[key]}`}
        use={TRACKING_USE[key]}
      />
    ))}
  </Section>
)

/** The Text component's variant roles — when to reach for which. */
export const Roles: Story = () => (
  <Section
    title="Text roles — the variant vocabulary"
    blurb="components/base/Text.tsx. Text is the PROSE primitive — reach for the role by intent, not by hand-styling. The square ink label is NOT here: it is Badge shape=&quot;stamp&quot; (Atoms/Badge)."
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
