import type { Story } from '@ladle/react'
import type { CSSProperties, ReactNode } from 'react'
import { statBlockRowStarts } from '../components/stat/pipRows'
import {
  borderWidth,
  color,
  font,
  fontSize,
  radius,
  space,
  tracking,
  weight,
} from '../design/tokens'

export default {
  title: 'Foundations/Theme',
}

// Migrated off Tailwind in #799 (epic #802). Every specimen on this page now
// resolves through `design/tokens.ts`, where it previously resolved through a
// `var(--color-*)` string or a utility class. That is the same guarantee in a
// stronger form: the maps below used to be the drift risk this page exists to
// prevent (they once carried hardcoded rgb values that had gone stale against
// theme.css in TEN places), and `var(--color-*)` fixed that by referencing.
// Reading the token object goes one further — a name that is not on the scale
// is now a TYPE ERROR rather than a variable that silently resolves to nothing.

// Shared caption in the catalog's canonical voice (design ruleset §4).
const captionStyle = {
  color: color.wkMuted,
  fontFamily: font.cond,
  fontSize: fontSize.label,
  letterSpacing: tracking.caps,
  textTransform: 'uppercase',
} satisfies CSSProperties

function Caption({ children }: { children: ReactNode }) {
  return <span style={captionStyle}>{children}</span>
}

const pageStyle = {
  display: 'flex',
  flexDirection: 'column',
  padding: space[16],
} satisfies CSSProperties

const h2Style = {
  color: color.ink,
  fontFamily: font.cond,
  fontSize: fontSize.lg,
  letterSpacing: tracking.capsTight,
  textTransform: 'uppercase',
} satisfies CSSProperties

const tokenNameStyle = {
  color: color.ink,
  fontFamily: font.cond,
  fontSize: fontSize.label,
  letterSpacing: tracking.capsTight,
} satisfies CSSProperties

// --- §4.1 Colour roles ---------------------------------------------------
// Every swatch renders a REAL token, never a raw hex, so the catalog stays
// ground-truth against the scale.
type ColorRole = {
  /** A key on the token scale — mistyping one no longer compiles. */
  swatch: keyof typeof color
  role: string
}

const colorRoles: ColorRole[] = [
  { swatch: 'ink', role: 'ink' },
  { swatch: 'paper', role: 'paper · system white' },
  { swatch: 'rust', role: 'rust · action' },
  { swatch: 'pilot', role: 'pilot' },
  { swatch: 'mech', role: 'mech' },
  { swatch: 'crawler', role: 'crawler' },
  { swatch: 'cargo', role: 'cargo' },
  { swatch: 'statusOk', role: 'status · ok' },
  { swatch: 'statusWarn', role: 'status · warn' },
  { swatch: 'statusBad', role: 'status · bad' },
]

/** `statusOk` → `--su-color-status-ok`, spelled as tokens.parity.test.ts spells it. */
const colorVarName = (key: string) =>
  `--su-color-${key
    .replace(/([A-Z])/g, '-$1')
    .replace(/(\d+)/g, '-$1')
    .toLowerCase()}`

function RoleSwatch({ swatch, role }: ColorRole) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: space[4], width: '128px' }}>
      <div
        style={{
          backgroundColor: color[swatch],
          border: `${borderWidth.chrome} solid ${color.ink}`,
          borderRadius: radius.card,
          height: '80px',
          width: '100%',
        }}
      />
      <Caption>{role}</Caption>
      <span style={tokenNameStyle}>{colorVarName(swatch)}</span>
    </div>
  )
}

/* Each specimen map is a list of KEYS on the token scale rather than a list of
   values. This is load-bearing, not stylistic: these maps used to hardcode rgb
   values and had silently drifted from theme.css in TEN places — `paper`,
   `ink-2`, `wk-muted`, `wk-faint`, the old `su-orange-dark`, and all five roll
   tiers, which still showed the stock-Material hues that the warm re-tone
   retired. The page whose entire job is to be the ground truth for the token
   system was misreporting it. A key cannot drift from the value it names. */
const coreColors = ['ink', 'ink2', 'inkDeep', 'paper', 'bandCream', 'rust', 'rustHi'] as const

const inkRamp = ['ink75', 'ink50', 'ink30', 'ink20', 'ink15', 'ink12', 'ink10', 'ink8'] as const

const groundColors = [
  'wkBg',
  'wkBg2',
  'wkMuted',
  'wkFaint',
  'wkLine',
  'wkAccent',
  'caution',
  'inert',
] as const

const techLevelColors = ['tl1', 'tl2', 'tl3', 'tl4', 'tl5', 'tl6', 'tlB', 'tlN'] as const

const semanticColors = [
  'pilot',
  'pilotLight',
  'mech',
  'mechDark',
  'crawler',
  'adversary',
  'cargo',
  'tierCore',
  'tierCorePale',
] as const

/* Bot-only. The web never colours roll outcomes (ruleset §3.4); these are shown
   so the warm ramp is inspectable, not because a web surface may use them. */
const rollColors = ['rollCascade', 'rollFailure', 'rollTough', 'rollSuccess', 'rollNailed'] as const

const statusColors = ['statusOk', 'statusWarn', 'statusBad'] as const

/* These two are NOT on the `--su-*` scale: they are the ShadCN-compat aliases
   declared in theme.css's plain `:root`, outside the Tailwind `@theme` block,
   and `Text` still reads `--foreground`. They are shown as the raw custom
   properties they are, because that is precisely what this story documents;
   they retire with theme.css in the Tailwind-removal layer (#801). */
const cssVarMappings: Record<string, string> = {
  '--background': 'var(--color-paper)',
  '--foreground': 'var(--color-ink)',
}

function Swatch({ name, value }: { name: string; value: string }) {
  return (
    <div
      style={{
        alignItems: 'center',
        display: 'flex',
        flexDirection: 'column',
        gap: space[4],
        width: '120px',
      }}
    >
      <div
        style={{
          backgroundColor: value,
          border: `${borderWidth.hairline} solid ${color.ink}`,
          borderRadius: radius.panel,
          height: '80px',
          width: '80px',
        }}
      />
      <span style={{ fontFamily: 'monospace', fontSize: fontSize.xs, textAlign: 'center' }}>
        {name}
      </span>
    </div>
  )
}

function ColorSection({ title, keys }: { title: string; keys: readonly (keyof typeof color)[] }) {
  return (
    <div style={{ marginBottom: space[24] }}>
      <h3
        style={{
          fontFamily: "'Fira Code', monospace",
          fontSize: fontSize.xl,
          fontWeight: weight.bold,
          marginBottom: space[12],
        }}
      >
        {title}
      </h3>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: space[16] }}>
        {keys.map((key) => (
          <Swatch
            key={key}
            name={colorVarName(key).replace('--su-color-', '')}
            value={color[key]}
          />
        ))}
      </div>
    </div>
  )
}

const pageHeadingStyle = {
  fontSize: fontSize.xl2,
  fontWeight: weight.bold,
  marginBottom: space[16],
} satisfies CSSProperties

const monoPageStyle = {
  fontFamily: "'Fira Code', monospace",
  padding: space[16],
} satisfies CSSProperties

export const ColorPalette: Story = () => (
  <div style={monoPageStyle}>
    <h2 style={pageHeadingStyle}>The Closed Colour Set</h2>
    <ColorSection title="Core — ink · paper · action" keys={coreColors} />
    <ColorSection title="Ink ramp — hairlines, placeholders, ghosts" keys={inkRamp} />
    <ColorSection title="Ground & attention" keys={groundColors} />
    <ColorSection title="State overlays" keys={statusColors} />
  </div>
)

export const TechLevelColors: Story = () => (
  <div style={monoPageStyle}>
    <h2 style={pageHeadingStyle}>Tech Level Colors</h2>
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: space[8] }}>
      {techLevelColors.map((key) => (
        <div
          key={key}
          style={{
            alignItems: 'center',
            display: 'flex',
            flexDirection: 'column',
            gap: space[4],
          }}
        >
          <div
            style={{
              alignItems: 'center',
              backgroundColor: color[key],
              borderRadius: radius.panel,
              display: 'flex',
              height: '60px',
              justifyContent: 'center',
              width: '100px',
            }}
          >
            <span style={{ color: 'white', fontSize: fontSize.xl, fontWeight: weight.bold }}>
              TL {key.replace('tl', '').toLowerCase()}
            </span>
          </div>
          <span style={{ fontSize: fontSize.label }}>
            {colorVarName(key).replace('--su-color-', '')}
          </span>
        </div>
      ))}
    </div>
  </div>
)

export const SemanticColors: Story = () => (
  <div style={monoPageStyle}>
    <h2 style={pageHeadingStyle}>Semantic Colors</h2>

    <ColorSection title="Entity Types" keys={semanticColors} />
    <ColorSection title="Roll Results" keys={rollColors} />
  </div>
)

export const CSSVariables: Story = () => (
  <div style={monoPageStyle}>
    <h2 style={pageHeadingStyle}>ShadCN CSS Variable Mappings</h2>
    <p style={{ color: 'rgb(80, 80, 80)', fontSize: fontSize.sm, marginBottom: space[16] }}>
      These CSS custom properties are set in <code>:root</code> and map to SU brand colors.
    </p>
    <div
      style={{
        display: 'grid',
        gap: space[12],
        gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
      }}
    >
      {Object.entries(cssVarMappings).map(([varName, value]) => (
        <div
          key={varName}
          style={{
            alignItems: 'center',
            border: '1px solid rgb(199, 199, 199)',
            borderRadius: radius.panel,
            display: 'flex',
            gap: space[12],
            padding: space[8],
          }}
        >
          <div
            style={{
              backgroundColor: `var(${varName})`,
              border: `${borderWidth.hairline} solid ${color.ink}`,
              borderRadius: radius.badge,
              flexShrink: 0,
              height: '40px',
              width: '40px',
            }}
          />
          <div style={{ overflow: 'hidden' }}>
            <div style={{ fontSize: fontSize.xs, fontWeight: weight.bold }}>{varName}</div>
            <div
              style={{
                color: 'rgb(80, 80, 80)',
                fontSize: fontSize.label,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {value}
            </div>
          </div>
        </div>
      ))}
    </div>
  </div>
)

// === Foundations, mirroring codex §03 =====================================

export const ColorRoles: Story = () => (
  <div style={{ ...pageStyle, gap: space[12] }}>
    <h2 style={h2Style}>Colour roles</h2>
    <Caption>
      the closed set — ink, paper (the one light surface), rust = action, the three entity tones,
      cargo, and status ok/warn/bad. State is a treatment, never a random colour.
    </Caption>
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: space[16] }}>
      {colorRoles.map((role) => (
        <RoleSwatch key={role.swatch} {...role} />
      ))}
    </div>
  </div>
)

/**
 * The caps tracking ladder.
 *
 * BEFORE #799 this story captioned two custom properties that do not exist —
 * `--tracking-label` and `--tracking-display` — and the second specimen set its
 * 0.01em inline, so the page asserted a token the stylesheet never declared.
 * (Foundations/Typography carried the same two phantoms in its own table, and
 * additionally rendered them via `tracking-label` / `tracking-display` utility
 * classes that resolved to nothing.) The real ladder is the five rungs below,
 * and iterating the token object is what keeps it honest.
 */
export const Tracking: Story = () => (
  <div style={{ ...pageStyle, gap: space[24] }}>
    <h2 style={h2Style}>The caps tracking ladder</h2>
    <Caption>Five rungs, shown on real uppercase label text.</Caption>

    {(Object.keys(tracking) as (keyof typeof tracking)[]).map((key) => (
      <div key={key} style={{ display: 'flex', flexDirection: 'column', gap: space[4] }}>
        <span
          style={{
            color: color.ink,
            fontFamily: font.cond,
            fontSize: fontSize.xl,
            letterSpacing: tracking[key],
            textTransform: 'uppercase',
          }}
        >
          Systems &amp; Modules
        </span>
        <Caption>
          {`--su-tracking-${key.replace(/([A-Z])/g, '-$1').toLowerCase()}`} · {tracking[key]} ·{' '}
          tracking.{key}
        </Caption>
      </div>
    ))}
  </div>
)

type BorderWeight = {
  token: keyof typeof borderWidth
  applies: string
}

const borderWeights: BorderWeight[] = [
  { token: 'entity', applies: 'entity cards + hero header' },
  { token: 'rail', applies: 'rail cards & Hold frames' },
  { token: 'pill', applies: 'pills / status badges / dividers' },
  { token: 'chrome', applies: 'buttons, inputs, panels, rows, pips' },
]

export const BorderMap: Story = () => (
  <div style={{ ...pageStyle, gap: space[12] }}>
    <h2 style={h2Style}>The border map</h2>
    <Caption>Canon weights, one meaning each — the ONE border vocabulary.</Caption>
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: space[20] }}>
      {borderWeights.map((w) => (
        <div
          key={w.token}
          style={{ display: 'flex', flexDirection: 'column', gap: space[4], width: '160px' }}
        >
          <div
            style={{
              alignItems: 'center',
              backgroundColor: color.paper,
              borderColor: color.ink,
              borderRadius: radius.card,
              borderStyle: 'solid',
              borderWidth: borderWidth[w.token],
              display: 'flex',
              height: '80px',
              justifyContent: 'center',
              width: '100%',
            }}
          >
            <span
              style={{
                color: color.ink,
                fontFamily: font.cond,
                fontSize: fontSize.sm,
                letterSpacing: tracking.capsTight,
              }}
            >
              {borderWidth[w.token]}
            </span>
          </div>
          <span style={tokenNameStyle}>--su-bw-{w.token}</span>
          <Caption>{w.applies}</Caption>
        </div>
      ))}
    </div>
  </div>
)

export const RadiusSpacing: Story = () => (
  <div style={{ ...pageStyle, gap: space[24] }}>
    <h2 style={h2Style}>Radius &amp; spacing</h2>
    <Caption>
      3px outer radius (card + Button — the one primitive allowed to round); inner = calc(3px −
      frame). Stamps are square. Spacing spends only {'{2, 4, 6, 8, 12}px'} — 12px = the card
      gutter.
    </Caption>

    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-start', gap: space[24] }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: space[4] }}>
        <div
          style={{
            backgroundColor: color.paper,
            border: `${borderWidth.entity} solid ${color.ink}`,
            borderRadius: radius.card,
            height: '96px',
            width: '160px',
          }}
        />
        <Caption>card · radius.card outer</Caption>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: space[4] }}>
        <button
          type="button"
          style={{
            backgroundColor: color.rust,
            borderRadius: radius.card,
            color: color.paper,
            fontFamily: font.cond,
            letterSpacing: tracking.capsTight,
            padding: `${space[8]} ${space[16]}`,
            textTransform: 'uppercase',
          }}
        >
          Commit
        </button>
        <Caption>Button · radius.card · rust = action</Caption>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: space[4] }}>
        <span
          style={{
            backgroundColor: color.ink,
            borderRadius: radius.none,
            color: color.paper,
            display: 'inline-block',
            fontFamily: font.cond,
            fontSize: fontSize.xs,
            letterSpacing: tracking.capsTight,
            padding: `${space[4]} ${space[8]}`,
            textTransform: 'uppercase',
          }}
        >
          Stamp
        </span>
        <Caption>stamp · square (radius.none)</Caption>
      </div>
    </div>
  </div>
)

const pipStyle = {
  border: `${borderWidth.chrome} solid ${color.ink}`,
  borderRadius: radius.badge,
  height: space[12] as string,
  width: space[12] as string,
} satisfies CSSProperties

function PipRows({ max, label }: { max: number; label: string }) {
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
        {statBlockRowStarts(max).map((row) => (
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
        <span style={{ color: color.wkMuted, fontWeight: weight.normal }}>({label})</span>
      </div>
    </div>
  )
}

/** Pip-row split — ≤6 per row, bottom-heavy (heavy row on the bottom), centred. */
export const PipSplit: Story = () => (
  <div style={{ ...pageStyle, gap: space[24] }}>
    <h2 style={h2Style}>Pip-row split</h2>
    <Caption>
      Every pip surface (gauges, statblocks, cargo) splits into balanced rows via the real
      statBlockRowStarts — ≤6 per row, bottom-heavy (the heavier row rides on the bottom).
    </Caption>
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: space[32] }}>
      <PipRows max={6} label="6" />
      <PipRows max={11} label="5/6" />
      <PipRows max={12} label="6/6" />
      <PipRows max={13} label="4/4/5" />
    </div>
  </div>
)
