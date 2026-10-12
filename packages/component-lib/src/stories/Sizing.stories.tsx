import type { CSSProperties } from 'react'
import { SalvageUnionReference } from 'salvageunion-reference'
import { Text } from '../components/base/Text'
import { Badge } from '../components/chrome/Badge'
import { borderWidth, color, font, fontSize, space, tracking, weight } from '../design/tokens'
import type { SizeRung } from '../styles/sizing'
import { DEFAULT_RUNG, RUNG_INLINE_PADDING, RUNG_TYPE } from '../styles/sizing'
import type { Story } from './_harness'
import { Caption } from './_harness'
import './_stories.css'

export default {
  title: 'Foundations/Sizing',
}

// Every size below is keyed by the constants Badge and the control buttons
// compose (`styles/sizing.ts`). Those constants are `.su-rung-*` class names
// now; these tables restate the theme.css token or px each class's rule in
// `styles/index.css` sets.
const RUNG_TYPE_TOKEN: Record<string, string> = {
  'su-rung-label--full': '--text-sm',
  'su-rung-label--compact': '--text-xs',
  'su-rung-label--mini': '--text-badge',
  'su-rung-body--full': '--text-lede',
  'su-rung-body--compact': '--text-caption',
  'su-rung-body--mini': '--text-note',
}
const RUNG_PAD_PX: Record<string, string> = {
  'su-rung-pad--full': '4px 8px',
  'su-rung-pad--compact': '2px 6px',
  'su-rung-pad--mini': '2px 4px',
}

const RUNG_FONT_SIZE = (rung: SizeRung) => ({
  label: RUNG_TYPE_TOKEN[RUNG_TYPE[rung].label] ?? '',
  body: RUNG_TYPE_TOKEN[RUNG_TYPE[rung].body] ?? '',
})

const RUNG_INLINE_PAD = (rung: SizeRung) => RUNG_PAD_PX[RUNG_INLINE_PADDING[rung]] ?? ''

/** Ladder order, largest first — specimen iteration only (the catalog page). */
const SIZE_RUNGS: readonly SizeRung[] = ['full', 'compact', 'mini']

/** What each rung is FOR, in one line; the definition is `styles/sizing.ts`. */
const INTENT: Record<SizeRung, string> = {
  full: 'The reading size.',
  compact: 'The default.',
  mini: 'The annotation size.',
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
        <span style={intentLineStyle}>{intent}</span>
        {rung === DEFAULT_RUNG && (
          <Badge shape="stamp" size="mini" surface="inverse">
            default
          </Badge>
        )}
      </header>

      {/* The one responsive rule on this page — a media query, so a class. */}
      <div className="su-story-split">
        <div style={columnStyle}>
          <Caption>label · {RUNG_FONT_SIZE(rung).label}</Caption>
          {/* The stamp reads its geometry from the ladder, so this specimen
              cannot drift from the token the way a hand-set example would. */}
          <Badge shape="stamp" size={rung}>
            {chassis?.name ?? 'Mule'}
          </Badge>
          <p style={{ ...mutedBodyStyle, fontSize: fontSize.note }}>
            {RUNG_INLINE_PAD(rung)} · {RUNG_FONT_SIZE(rung).label}
          </p>
        </div>

        <div style={columnStyle}>
          <Caption>body · {RUNG_FONT_SIZE(rung).body}</Caption>
          <Text variant="body" style={{ fontSize: `var(${RUNG_FONT_SIZE(rung).body})` }}>
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
 * These three names are defined by INTENT, not relative to their own
 * component, so they mean the same thing wherever they are read.
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
        Three rungs, named for what they are for. Which rungs a component offers and which it rests
        at: <code style={monoNoteStyle}>src/styles/sizing.ts</code>.
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
                fontSize: fontSize.badge,
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
                  fontSize: `var(${RUNG_FONT_SIZE(rung).label})`,
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
                  fontSize: `var(${RUNG_FONT_SIZE(rung).body})`,
                }}
              >
                Salvage Union
              </span>
            </td>
            <td style={{ ...cellStyle, ...monoNoteStyle }}>{RUNG_INLINE_PAD(rung)}</td>
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
