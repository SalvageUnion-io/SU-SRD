import type { Story } from '@ladle/react'
import type { ReactNode } from 'react'
import { statBlockRowStarts } from '../components/stat/pipRows'

export default {
  title: 'Foundations/Theme',
}

// Shared caption in the catalog's canonical voice (design ruleset §4).
function Caption({ children }: { children: ReactNode }) {
  return (
    <span className="font-cond text-label uppercase tracking-caps text-wk-muted">{children}</span>
  )
}

// --- §4.1 Colour roles ---------------------------------------------------
// Every swatch renders a REAL token via its Tailwind utility class (never a
// raw hex) so the catalog stays ground-truth against theme.css.
type ColorRole = {
  bg: string
  role: string
  token: string
}

const colorRoles: ColorRole[] = [
  { bg: 'bg-ink', role: 'ink', token: '--color-ink' },
  { bg: 'bg-paper', role: 'paper · system white', token: '--color-paper' },
  { bg: 'bg-rust', role: 'rust · action', token: '--color-rust' },
  { bg: 'bg-pilot', role: 'pilot', token: '--color-pilot' },
  { bg: 'bg-mech', role: 'mech', token: '--color-mech' },
  { bg: 'bg-crawler', role: 'crawler', token: '--color-crawler' },
  { bg: 'bg-cargo', role: 'cargo', token: '--color-cargo' },
  { bg: 'bg-status-ok', role: 'status · ok', token: '--color-status-ok' },
  { bg: 'bg-status-warn', role: 'status · warn', token: '--color-status-warn' },
  { bg: 'bg-status-bad', role: 'status · bad', token: '--color-status-bad' },
]

function RoleSwatch({ bg, role, token }: ColorRole) {
  return (
    <div className="flex w-[128px] flex-col gap-1">
      <div
        className={`h-20 w-full rounded-card border-chrome border-ink ${bg}`}
        style={{ borderColor: 'var(--color-ink)' }}
      />
      <Caption>{role}</Caption>
      <span className="font-cond text-label tracking-caps-tight text-ink">{token}</span>
    </div>
  )
}

/* Every specimen map below resolves through `var(--color-*)` rather than a
   literal. This is load-bearing, not stylistic: these maps used to hardcode rgb
   values and had silently drifted from theme.css in TEN places — `paper`,
   `ink-2`, `wk-muted`, `wk-faint`, the old `su-orange-dark`, and all five roll
   tiers, which still showed the stock-Material hues that the warm re-tone
   retired. The page whose entire job is to be the ground truth for the token
   system was misreporting it. Referencing the tokens makes drift impossible. */
const coreColors: Record<string, string> = {
  ink: 'var(--color-ink)',
  'ink-2': 'var(--color-ink-2)',
  'ink-deep': 'var(--color-ink-deep)',
  paper: 'var(--color-paper)',
  'band-cream': 'var(--color-band-cream)',
  rust: 'var(--color-rust)',
  'rust-hi': 'var(--color-rust-hi)',
}

const inkRamp: Record<string, string> = {
  'ink-75': 'var(--color-ink-75)',
  'ink-50': 'var(--color-ink-50)',
  'ink-30': 'var(--color-ink-30)',
  'ink-12': 'var(--color-ink-12)',
  'ink-8': 'var(--color-ink-8)',
}

const groundColors: Record<string, string> = {
  'wk-bg': 'var(--color-wk-bg)',
  'wk-bg-2': 'var(--color-wk-bg-2)',
  'wk-muted': 'var(--color-wk-muted)',
  'wk-faint': 'var(--color-wk-faint)',
  'wk-line': 'var(--color-wk-line)',
  'wk-accent': 'var(--color-wk-accent)',
  caution: 'var(--color-caution)',
  inert: 'var(--color-inert)',
}

const techLevelColors: Record<string, string> = {
  '1': 'var(--color-tl-1)',
  '2': 'var(--color-tl-2)',
  '3': 'var(--color-tl-3)',
  '4': 'var(--color-tl-4)',
  '5': 'var(--color-tl-5)',
  '6': 'var(--color-tl-6)',
  b: 'var(--color-tl-b)',
  n: 'var(--color-tl-n)',
}

const semanticColors: Record<string, string> = {
  pilot: 'var(--color-pilot)',
  'pilot-light': 'var(--color-pilot-light)',
  mech: 'var(--color-mech)',
  'mech-dark': 'var(--color-mech-dark)',
  crawler: 'var(--color-crawler)',
  adversary: 'var(--color-adversary)',
  cargo: 'var(--color-cargo)',
  'tier-core': 'var(--color-tier-core)',
  'tier-core-pale': 'var(--color-tier-core-pale)',
}

/* Bot-only. The web never colours roll outcomes (ruleset §3.4); these are shown
   so the warm ramp is inspectable, not because a web surface may use them. */
const rollColors: Record<string, string> = {
  'roll-cascade': 'var(--color-roll-cascade)',
  'roll-failure': 'var(--color-roll-failure)',
  'roll-tough': 'var(--color-roll-tough)',
  'roll-success': 'var(--color-roll-success)',
  'roll-nailed': 'var(--color-roll-nailed)',
}

const statusColors: Record<string, string> = {
  'status-ok': 'var(--color-status-ok)',
  'status-warn': 'var(--color-status-warn)',
  'status-bad': 'var(--color-status-bad)',
}

const cssVarMappings: Record<string, string> = {
  '--background': 'var(--color-paper)',
  '--foreground': 'var(--color-ink)',
}

function Swatch({ name, color }: { name: string; color: string }) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '0.25rem',
        width: '120px',
      }}
    >
      <div
        style={{
          width: '80px',
          height: '80px',
          backgroundColor: color,
          borderRadius: '0.375rem',
          border: '1px solid rgb(40, 32, 25)',
        }}
      />
      <span style={{ fontSize: '0.75rem', textAlign: 'center', fontFamily: 'monospace' }}>
        {name}
      </span>
    </div>
  )
}

function ColorSection({ title, colors }: { title: string; colors: Record<string, string> }) {
  return (
    <div style={{ marginBottom: '1.5rem' }}>
      <h3
        style={{
          fontFamily: "'Fira Code', monospace",
          fontSize: '1.25rem',
          fontWeight: 'bold',
          marginBottom: '0.75rem',
        }}
      >
        {title}
      </h3>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem' }}>
        {Object.entries(colors).map(([name, value]) => (
          <Swatch key={name} name={name} color={value} />
        ))}
      </div>
    </div>
  )
}

export const ColorPalette: Story = () => (
  <div style={{ fontFamily: "'Fira Code', monospace", padding: '1rem' }}>
    <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '1rem' }}>
      The Closed Colour Set
    </h2>
    <ColorSection title="Core — ink · paper · action" colors={coreColors} />
    <ColorSection title="Ink ramp — hairlines, placeholders, ghosts" colors={inkRamp} />
    <ColorSection title="Ground & attention" colors={groundColors} />
    <ColorSection title="State overlays" colors={statusColors} />
  </div>
)

export const TechLevelColors: Story = () => (
  <div style={{ fontFamily: "'Fira Code', monospace", padding: '1rem' }}>
    <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '1rem' }}>
      Tech Level Colors
    </h2>
    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
      {Object.entries(techLevelColors).map(([level, color]) => (
        <div
          key={level}
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '0.25rem',
          }}
        >
          <div
            style={{
              width: '100px',
              height: '60px',
              backgroundColor: color,
              borderRadius: '0.375rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <span style={{ color: 'white', fontWeight: 'bold', fontSize: '1.25rem' }}>
              TL {level}
            </span>
          </div>
          <span style={{ fontSize: '0.625rem' }}>tl-{level}</span>
        </div>
      ))}
    </div>
  </div>
)

export const SemanticColors: Story = () => (
  <div style={{ fontFamily: "'Fira Code', monospace", padding: '1rem' }}>
    <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '1rem' }}>
      Semantic Colors
    </h2>

    <ColorSection title="Entity Types" colors={semanticColors} />
    <ColorSection title="Roll Results" colors={rollColors} />
  </div>
)

export const CSSVariables: Story = () => (
  <div style={{ fontFamily: "'Fira Code', monospace", padding: '1rem' }}>
    <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '1rem' }}>
      ShadCN CSS Variable Mappings
    </h2>
    <p style={{ fontSize: '0.875rem', marginBottom: '1rem', color: 'rgb(80, 80, 80)' }}>
      These CSS custom properties are set in <code>:root</code> and map to SU brand colors.
    </p>
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
        gap: '0.75rem',
      }}
    >
      {Object.entries(cssVarMappings).map(([varName, value]) => (
        <div
          key={varName}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            padding: '0.5rem',
            border: '1px solid rgb(199, 199, 199)',
            borderRadius: '0.375rem',
          }}
        >
          <div
            style={{
              width: '40px',
              height: '40px',
              backgroundColor: `var(${varName})`,
              borderRadius: '0.25rem',
              border: '1px solid rgb(40, 32, 25)',
              flexShrink: 0,
            }}
          />
          <div style={{ overflow: 'hidden' }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 'bold' }}>{varName}</div>
            <div
              style={{
                fontSize: '0.625rem',
                color: 'rgb(80, 80, 80)',
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
  <div className="flex flex-col gap-3 p-4">
    <h2 className="font-cond text-lg uppercase tracking-caps-tight text-ink">Colour roles</h2>
    <Caption>
      the closed set — ink, paper (system white #fbfaf7), rust = action, the three entity tones,
      cargo, and status ok/warn/bad. State is a treatment, never a random colour.
    </Caption>
    <div className="flex flex-wrap gap-4">
      {colorRoles.map((role) => (
        <RoleSwatch key={role.token} {...role} />
      ))}
    </div>
  </div>
)

export const Tracking: Story = () => (
  <div className="flex flex-col gap-6 p-4">
    <h2 className="font-cond text-lg uppercase tracking-caps-tight text-ink">One label tracking</h2>
    <Caption>15 tracking values today → 3. Shown on real uppercase label text.</Caption>

    <div className="flex flex-col gap-1">
      <span className="font-cond text-xl uppercase text-ink tracking-caps-tight">
        Systems &amp; Modules
      </span>
      <Caption>--tracking-label · 0.04em · every stamp / label / tab (tracking-caps-tight)</Caption>
    </div>

    <div className="flex flex-col gap-1">
      <span className="font-cond text-2xl uppercase text-ink" style={{ letterSpacing: '0.01em' }}>
        Iron Mongrel
      </span>
      <Caption>--tracking-display · 0.01em · titles ≥22px + buttons</Caption>
    </div>

    <div className="flex flex-col gap-1">
      <span className="font-cond text-sm uppercase text-ink tracking-eyebrow">Salvage Union</span>
      <Caption>--tracking-eyebrow · 0.22em · brand caption only (tracking-eyebrow)</Caption>
    </div>
  </div>
)

type BorderWeight = {
  cssWidth: string
  token: string
  label: string
  applies: string
}

const borderWeights: BorderWeight[] = [
  {
    cssWidth: 'var(--bw-entity)',
    token: '--bw-entity',
    label: '3px',
    applies: 'entity cards + hero header',
  },
  {
    cssWidth: 'var(--bw-rail)',
    token: '--bw-rail',
    label: '2.5px',
    applies: 'rail cards & Hold frames',
  },
  {
    cssWidth: 'var(--bw-pill)',
    token: '--bw-pill',
    label: '2px',
    applies: 'pills / status badges / dividers',
  },
  {
    cssWidth: 'var(--bw-chrome)',
    token: '--bw-chrome',
    label: '1.5px',
    applies: 'buttons, inputs, panels, rows, pips',
  },
]

export const BorderMap: Story = () => (
  <div className="flex flex-col gap-3 p-4">
    <h2 className="font-cond text-lg uppercase tracking-caps-tight text-ink">The border map</h2>
    <Caption>
      Canon weights, one meaning each — the ONE border vocabulary, never border-[1.5px].
    </Caption>
    <div className="flex flex-wrap gap-5">
      {borderWeights.map((w) => (
        <div key={w.token} className="flex w-[160px] flex-col gap-1">
          <div
            className="flex h-20 w-full items-center justify-center rounded-card bg-paper"
            style={{
              borderStyle: 'solid',
              borderWidth: w.cssWidth,
              borderColor: 'var(--color-ink)',
            }}
          >
            <span className="font-cond text-sm tracking-caps-tight text-ink">{w.label}</span>
          </div>
          <span className="font-cond text-label tracking-caps-tight text-ink">{w.token}</span>
          <Caption>{w.applies}</Caption>
        </div>
      ))}
    </div>
  </div>
)

export const RadiusSpacing: Story = () => (
  <div className="flex flex-col gap-6 p-4">
    <h2 className="font-cond text-lg uppercase tracking-caps-tight text-ink">
      Radius &amp; spacing
    </h2>
    <Caption>
      3px outer radius (card + Button — the one primitive allowed to round); inner = calc(3px −
      frame). Stamps are square. Spacing spends only {'{2, 4, 6, 8, 12}px'} — 12px = the card
      gutter.
    </Caption>

    <div className="flex flex-wrap items-start gap-6">
      <div className="flex flex-col gap-1">
        <div
          className="h-24 w-40 rounded-card bg-paper"
          style={{ border: 'var(--bw-entity) solid var(--color-ink)' }}
        />
        <Caption>card · rounded-card outer</Caption>
      </div>

      <div className="flex flex-col gap-1">
        <button
          type="button"
          className="rounded-card bg-rust px-4 py-2 font-cond uppercase tracking-caps-tight text-paper"
          style={{ letterSpacing: '0.01em' }}
        >
          Commit
        </button>
        <Caption>Button · rounded-card · rust = action</Caption>
      </div>

      <div className="flex flex-col gap-1">
        <span className="inline-block rounded-none bg-ink px-2 py-1 font-cond text-xs uppercase tracking-caps-tight text-paper">
          Stamp
        </span>
        <Caption>stamp · square (rounded-none)</Caption>
      </div>
    </div>
  </div>
)

const PIP = 'h-3 w-3 rounded-badge border-chrome border-ink'

function PipRows({ max, label }: { max: number; label: string }) {
  return (
    <div className="flex w-40 flex-col gap-2">
      <div className="flex flex-col items-center gap-1">
        {statBlockRowStarts(max).map((row) => (
          <div key={row.start} className="flex gap-1">
            {Array.from({ length: row.count }, (_, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: pips are positional — the index IS their identity
              <span key={row.start + i} className={PIP} />
            ))}
          </div>
        ))}
      </div>
      <div className="text-xs font-bold text-ink">
        max = {max} <span className="font-normal text-wk-muted">({label})</span>
      </div>
    </div>
  )
}

/** Pip-row split — ≤6 per row, bottom-heavy (heavy row on the bottom), centred. */
export const PipSplit: Story = () => (
  <div className="flex flex-col gap-6 p-4">
    <h2 className="font-cond text-lg uppercase tracking-caps-tight text-ink">Pip-row split</h2>
    <Caption>
      Every pip surface (gauges, statblocks, cargo) splits into balanced rows via the real
      statBlockRowStarts — ≤6 per row, bottom-heavy (the heavier row rides on the bottom).
    </Caption>
    <div className="flex flex-wrap gap-8">
      <PipRows max={6} label="6" />
      <PipRows max={11} label="5/6" />
      <PipRows max={12} label="6/6" />
      <PipRows max={13} label="4/4/5" />
    </div>
  </div>
)
