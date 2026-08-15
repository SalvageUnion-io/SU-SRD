import type { Story } from '@ladle/react'
import type { CSSProperties } from 'react'
import { SalvageUnionReference } from 'salvageunion-reference'
import { Text } from '../components/base/Text'
import { Badge } from '../components/chrome/Badge'
import { borderWidth, color, font, fontSize, space, tracking, weight } from '../design/tokens'
import type { SizeRung } from '../styles/sizing'
import { DEFAULT_RUNG, RUNG_FONT_SIZE, RUNG_INLINE_PAD } from '../styles/sizing'
import { Caption } from './_harness'
import './_stories.css'

export default {
  title: 'Foundations/Sizing',
}

// Migrated off Tailwind in #799 (epic #802). The specimens now read
// `RUNG_FONT_SIZE` / `RUNG_INLINE_PAD` from `styles/sizing.ts` — the token-valued
// half of the same ladder Badge and Button consume — so the page still cannot
// drift from the code, and the values it PRINTS are the real sizes rather than
// the names of utility classes that are on their way out of the build.

/** Ladder order, largest first — specimen iteration only (the catalog page). */
const SIZE_RUNGS: readonly SizeRung[] = ['full', 'compact', 'mini']

/** What each rung is FOR — the rule, not the pixel count. */
const INTENT: Record<SizeRung, { line: string; use: string }> = {
  full: {
    line: 'The reading size.',
    use: 'A surface the user is looking at — a sheet header, a primary action, the card the page is about.',
  },
  compact: {
    line: 'The default.',
    use: 'A surface the user is scanning past — a listing row, a section label, a secondary control.',
  },
  mini: {
    line: 'The annotation size.',
    use: 'Attached to another element and never read alone — a count, a tech-level tag, a stamp riding a frame.',
  },
}

/** Real game terms — a specimen must never be lorem. */
const chassis = SalvageUnionReference.Chassis.all()[0]

const sectionStyle = {
  borderTop: `${borderWidth.chrome} solid ${color.ink15}`,
  paddingTop: space[16],
} satisfies CSSProperties

const headerStyle = {
  alignItems: 'baseline',
  columnGap: space[12],
  display: 'flex',
  flexWrap: 'wrap',
  marginBottom: space[12],
  rowGap: space[4],
} satisfies CSSProperties

const intentLineStyle = {
  color: color.ink,
  fontFamily: font.body,
  fontSize: fontSize.caption,
  fontWeight: weight.bold,
} satisfies CSSProperties

const mutedBodyStyle = {
  color: color.wkMuted,
  fontFamily: font.body,
  fontSize: fontSize.caption,
} satisfies CSSProperties

const monoNoteStyle = {
  color: color.wkMuted,
  fontFamily: 'monospace',
  fontSize: fontSize.note,
} satisfies CSSProperties

/** A `space-y-2` column. */
const columnStyle = {
  display: 'flex',
  flexDirection: 'column',
  gap: space[8],
} satisfies CSSProperties

function Rung({ rung }: { rung: SizeRung }) {
  const intent = INTENT[rung]
  return (
    <section style={sectionStyle}>
      <header style={headerStyle}>
        <Badge shape="stamp" size={rung}>
          {rung}
        </Badge>
        <span style={intentLineStyle}>{intent.line}</span>
        {rung === DEFAULT_RUNG && (
          <Badge shape="stamp" size="mini" surface="inverse">
            default
          </Badge>
        )}
      </header>

      <p style={{ ...mutedBodyStyle, marginBottom: space[16], maxWidth: '65ch' }}>{intent.use}</p>

      {/* The one responsive rule on this page — a media query, so a class. */}
      <div className="su-story-split">
        <div style={columnStyle}>
          <Caption>label · {RUNG_FONT_SIZE[rung].label}</Caption>
          {/* The stamp reads its geometry from the ladder, so this specimen
              cannot drift from the token the way a hand-set example would. */}
          <Badge shape="stamp" size={rung}>
            {chassis?.name ?? 'Mule'}
          </Badge>
          <p style={{ ...mutedBodyStyle, fontSize: fontSize.note }}>
            {RUNG_INLINE_PAD[rung]} · {RUNG_FONT_SIZE[rung].label}
          </p>
        </div>

        <div style={columnStyle}>
          <Caption>body · {RUNG_FONT_SIZE[rung].body}</Caption>
          <Text variant="body" style={{ fontSize: RUNG_FONT_SIZE[rung].body }}>
            Structure Points are restored during Downtime at the Union Crawler.
          </Text>
        </div>
      </div>
    </section>
  )
}

/**
 * The FULL / COMPACT / MINI ladder — one size vocabulary for the whole system.
 *
 * Size axes used to be named relative to their own component (`sm | md | lg` on
 * a stamp, `xs | sm | md | lg` on a button), so a name told you nothing about
 * which rung a surface belonged to and two components' `sm` were unrelated.
 * These three names are defined by INTENT, so they mean the same thing wherever
 * they are read.
 *
 * Every specimen below is rendered from `src/styles/sizing.ts` — the same
 * constants the components consume — so the catalog cannot drift from the code.
 */
export const Default: Story = () => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: space[24], maxWidth: '48rem' }}>
    <div>
      <h2
        style={{
          color: color.ink,
          fontFamily: font.cond,
          fontSize: fontSize.lede,
          fontWeight: weight.bold,
          letterSpacing: tracking.caps,
          marginBottom: space[4],
          textTransform: 'uppercase',
        }}
      >
        The size ladder
      </h2>
      <p style={{ ...mutedBodyStyle, maxWidth: '65ch' }}>
        Three rungs, named for what they are for. A component offers the rungs it genuinely has and
        names them from this list — a two-rung component with{' '}
        <code style={monoNoteStyle}>compact</code> and <code style={monoNoteStyle}>mini</code> is
        correct and complete. Scan-past elements rest at <code style={monoNoteStyle}>compact</code>
        {'; '}a component whose resting anatomy is a destination readout (the poster gauge, the
        reading callout) rests at <code style={monoNoteStyle}>full</code>.
      </p>
    </div>

    {SIZE_RUNGS.map((rung) => (
      <Rung key={rung} rung={rung} />
    ))}
  </div>
)

/**
 * Label and body do NOT move together — a compact row can carry mini labels
 * over body-size text, which is why the ladder defines the two separately.
 */
export const LabelVersusBody: Story = () => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: space[12], maxWidth: '48rem' }}>
    <Caption>each rung's label size beside its body size</Caption>
    <table style={{ borderCollapse: 'collapse', textAlign: 'left', width: '100%' }}>
      <thead>
        <tr>
          {['rung', 'label', 'body', 'inline padding'].map((h) => (
            <th
              key={h}
              style={{
                borderBottom: `${borderWidth.hairline} solid ${color.ink15}`,
                color: color.wkMuted,
                fontFamily: font.cond,
                fontSize: fontSize.micro,
                fontWeight: weight.bold,
                letterSpacing: tracking.capsWide,
                padding: `${space[6]} ${space[8]}`,
                textTransform: 'uppercase',
              }}
            >
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {SIZE_RUNGS.map((rung) => (
          <tr key={rung}>
            <td style={cellStyle}>
              <Badge shape="stamp" size={rung}>
                {rung}
              </Badge>
            </td>
            <td style={cellStyle}>
              <span
                style={{
                  color: color.ink,
                  fontFamily: font.cond,
                  fontSize: RUNG_FONT_SIZE[rung].label,
                  fontWeight: weight.bold,
                  textTransform: 'uppercase',
                }}
              >
                Salvage Union
              </span>
            </td>
            <td style={cellStyle}>
              <span
                style={{
                  color: color.ink,
                  fontFamily: font.body,
                  fontSize: RUNG_FONT_SIZE[rung].body,
                }}
              >
                Salvage Union
              </span>
            </td>
            <td style={{ ...cellStyle, ...monoNoteStyle }}>{RUNG_INLINE_PAD[rung]}</td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
)

const cellStyle = {
  borderBottom: `${borderWidth.hairline} solid ${color.ink10}`,
  padding: `${space[8]} ${space[8]}`,
} satisfies CSSProperties
