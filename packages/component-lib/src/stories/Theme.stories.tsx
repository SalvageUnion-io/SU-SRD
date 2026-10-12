import type { CSSProperties } from 'react'
import { statBlockRowStarts } from '../components/stat/pipRows'
import {
  borderWidth,
  color,
  font,
  fontSize,
  radius,
  space,
  speckle,
  weight,
} from '../design/tokens'
import themeCss from '../styles/theme.css?raw'
import { FoundationPage, RulesetRef, TokenLabel } from './_foundations'
import type { Story } from './_harness'
import { Caption } from './_harness'
import type { ThemeToken } from './_themeTokens'
import { familiesOf, parseThemeTokens, resolveToken, tokensIn } from './_themeTokens'

export default {
  title: 'Foundations/Theme',
}

// The token specimens below (Colors, BorderMap, RadiusSpacing) are generated
// from theme.css's own source, so they cannot drift from it; what each token
// is FOR is the ruleset's, and each page links to its section. PipSplit and
// Texture specimen the code and tokens.ts objects that render them.
const tokens = parseThemeTokens(themeCss)

const swatchStyle = {
  border: `${borderWidth.hairline} solid ${color.ink}`,
  borderRadius: radius.card,
  height: '56px',
  width: '100%',
} satisfies CSSProperties

function Swatch({ token }: { token: ThemeToken }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: space[4], width: '148px' }}>
      <div style={{ ...swatchStyle, background: resolveToken(token.value, tokens) }} />
      <TokenLabel token={token} />
    </div>
  )
}

const wrapStyle = { display: 'flex', flexWrap: 'wrap', gap: space[16] } satisfies CSSProperties

/** Every `--color-*` theme.css declares, grouped by family, in source order. */
export const Colors: Story = () => (
  <FoundationPage
    title="The closed colour set"
    blurb={
      <>
        Every <code>--color-*</code> in theme.css, grouped by family. Roles and uses:{' '}
        <RulesetRef section="4.1" />; the roll tiers are bot-only (<RulesetRef section="3.4" />
        ).
      </>
    }
  >
    {familiesOf(tokens, '--color-').map(([family, members]) => (
      <section key={family} style={{ display: 'flex', flexDirection: 'column', gap: space[8] }}>
        <Caption>{family}</Caption>
        <div style={wrapStyle}>
          {members.map((t) => (
            <Swatch key={t.name} token={t} />
          ))}
        </div>
      </section>
    ))}
  </FoundationPage>
)

/** Every `--bw-*` border weight, drawn at its own width. */
export const BorderMap: Story = () => (
  <FoundationPage
    title="The border map"
    blurb={
      <>
        Every <code>--bw-*</code> in theme.css. One meaning per weight: <RulesetRef section="4.3" />
        .
      </>
    }
  >
    <div style={wrapStyle}>
      {tokensIn(tokens, '--bw-').map((t) => (
        <div
          key={t.name}
          style={{ display: 'flex', flexDirection: 'column', gap: space[4], width: '148px' }}
        >
          <div
            style={{
              backgroundColor: color.paper,
              border: `${t.value} solid ${color.ink}`,
              borderRadius: radius.card,
              height: '64px',
            }}
          />
          <TokenLabel token={t} />
        </div>
      ))}
    </div>
  </FoundationPage>
)

/** Every `--radius-*` on a frame, and every `--space-*` as a bar of its length. */
export const RadiusSpacing: Story = () => (
  <FoundationPage
    title="Radius &amp; spacing"
    blurb={
      <>
        Every <code>--radius-*</code> and <code>--space-*</code> in theme.css. Which rungs a surface
        may spend: <RulesetRef section="4.4" />.
      </>
    }
  >
    <div style={wrapStyle}>
      {tokensIn(tokens, '--radius-').map((t) => (
        <div
          key={t.name}
          style={{ display: 'flex', flexDirection: 'column', gap: space[4], width: '148px' }}
        >
          <div
            style={{
              backgroundColor: color.paper,
              border: `${borderWidth.entity} solid ${color.ink}`,
              borderRadius: t.value,
              height: '64px',
            }}
          />
          <TokenLabel token={t} />
        </div>
      ))}
    </div>
    <div style={{ display: 'flex', flexDirection: 'column', gap: space[8] }}>
      {tokensIn(tokens, '--space-').map((t) => (
        <div key={t.name} style={{ alignItems: 'center', display: 'flex', gap: space[12] }}>
          <span style={{ width: '96px' }}>
            <TokenLabel token={t} />
          </span>
          <span style={{ backgroundColor: color.ink, height: space[12], width: t.value }} />
        </div>
      ))}
    </div>
  </FoundationPage>
)

const pipStyle = {
  border: `${borderWidth.chrome} solid ${color.ink}`,
  borderRadius: radius.badge,
  height: space[12] as string,
  width: space[12] as string,
} satisfies CSSProperties

function PipRows({ max }: { max: number }) {
  const rows = statBlockRowStarts(max)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: space[8], width: '160px' }}>
      <div
        style={{
          alignItems: 'center',
          display: 'flex',
          flexDirection: 'column',
          gap: space[4],
        }}
      >
        {rows.map((row) => (
          <div key={row.start} style={{ display: 'flex', gap: space[4] }}>
            {Array.from({ length: row.count }, (_, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: pips are positional — the index IS their identity
              <span key={row.start + i} style={pipStyle} />
            ))}
          </div>
        ))}
      </div>
      <div style={{ color: color.ink, fontSize: fontSize.xs, fontWeight: weight.bold }}>
        max = {max}{' '}
        <span style={{ color: color.wkMuted, fontWeight: weight.normal }}>
          ({rows.map((row) => row.count).join('/')})
        </span>
      </div>
    </div>
  )
}

/** Pip-row split, drawn by the real `statBlockRowStarts`. */
export const PipSplit: Story = () => (
  <FoundationPage
    title="Pip-row split"
    blurb={
      <>
        Every pip surface splits its rows with the real <code>statBlockRowStarts</code>. The rule:{' '}
        <RulesetRef section="4.5" />.
      </>
    }
  >
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: space[32] }}>
      {[6, 11, 12, 13].map((max) => (
        <PipRows key={max} max={max} />
      ))}
    </div>
  </FoundationPage>
)

/* ── Texture: the light speckle (ruleset §3.5, board 05c) ─────────────────── */

type Grain = keyof typeof speckle.grains

/** The three filters, built from `speckle.filters` — once per page. */
function SpeckleFilters() {
  return (
    <svg aria-hidden="true" width="0" height="0" style={{ position: 'absolute' }}>
      <defs>
        {Object.values(speckle.filters).map((f) => (
          <filter key={f.id} id={f.id} x="0" y="0" width="100%" height="100%">
            <feTurbulence
              type="fractalNoise"
              baseFrequency={f.baseFrequency}
              numOctaves={f.numOctaves}
              seed={f.seed}
              result="n"
            />
            <feColorMatrix
              in="n"
              type="matrix"
              values={`0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  ${f.gain} 0 0 0 ${f.threshold}`}
              result="m"
            />
            <feComposite in="SourceGraphic" in2="m" operator="in" />
          </filter>
        ))}
      </defs>
    </svg>
  )
}

const overlayStyle = {
  inset: 0,
  pointerEvents: 'none',
  position: 'absolute',
} satisfies CSSProperties

/** One grain's layers, laid over its positioned parent, behind the content. */
function SpeckleLayers({ grain }: { grain: Grain }) {
  return (
    <>
      {speckle.grains[grain].map((layer) => (
        <svg key={layer.filter} aria-hidden="true" width="100%" height="100%" style={overlayStyle}>
          <rect
            width="100%"
            height="100%"
            fill={layer.fill}
            opacity={layer.opacity}
            filter={`url(#${speckle.filters[layer.filter].id})`}
          />
        </svg>
      ))}
    </>
  )
}

const notchStyle = {
  backgroundColor: color.paper,
  color: color.ink,
  fontFamily: font.cond,
  fontSize: fontSize.lede,
  fontWeight: weight.extrabold,
  padding: `${space[2]} ${space[8]} 0 ${space[6]}`,
  position: 'relative',
  textTransform: 'uppercase',
} satisfies CSSProperties

/** The five chapter bands board 05c specimens, each with ink speckle. */
const chapterBands: readonly { name: string; band: keyof typeof color }[] = [
  { name: 'Rules', band: 'wkLine' },
  { name: 'Pilot Bay', band: 'pilot' },
  { name: 'Mech Workshop', band: 'mech' },
  { name: 'Union Crawler', band: 'crawler' },
  { name: 'Denizens', band: 'denizenBand' },
]

function ChapterBand({ name, band }: { name: string; band: keyof typeof color }) {
  return (
    <div
      style={{
        alignItems: 'flex-end',
        backgroundColor: color[band],
        border: `${borderWidth.chrome} solid ${color.ink}`,
        display: 'flex',
        height: '56px',
        padding: `0 ${space[8]}`,
        position: 'relative',
        width: '220px',
      }}
    >
      <SpeckleLayers grain="ink" />
      <span style={notchStyle}>{name}</span>
    </div>
  )
}

/**
 * The light speckle — ink grain on a colour band, paper flecks on an ink
 * ground — rendered from the `speckle` and `texture` tokens. Never on paper,
 * buttons, fields, the Dashboard or tooltips (`tokens/texture-placement`).
 */
export const Texture: Story = () => (
  <FoundationPage
    title="Texture — the light speckle"
    blurb={
      <>
        Drawn from the <code>speckle</code> filters and the <code>--texture-*</code> opacities.
        Where it may sit: <RulesetRef section="3.5" />.
      </>
    }
  >
    <SpeckleFilters />
    <Caption>Ink speckle on a chapter band (su-blot + su-speck)</Caption>
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: space[16] }}>
      {chapterBands.map((b) => (
        <ChapterBand key={b.name} {...b} />
      ))}
    </div>
    <Caption>Paper flecks on an ink ground (su-fleck)</Caption>
    <div
      style={{
        backgroundColor: color.ink,
        color: color.paper,
        fontFamily: font.cond,
        fontSize: fontSize.title,
        fontWeight: weight.extrabold,
        padding: `${space[8]} ${space[16]}`,
        position: 'relative',
        textTransform: 'uppercase',
        width: 'fit-content',
      }}
    >
      <SpeckleLayers grain="paper" />
      <span style={{ position: 'relative' }}>Workshop Manual</span>
    </div>
  </FoundationPage>
)
