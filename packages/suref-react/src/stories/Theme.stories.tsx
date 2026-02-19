import type { Story } from '@ladle/react'

export default {
  title: 'Theme',
}

const brandColors: Record<string, string> = {
  'su-orange': 'rgb(239, 137, 79)',
  'su-orange-dark': 'rgb(200, 100, 50)',
  'su-orange-light': 'rgb(245, 193, 163)',
  'su-green': 'rgb(122, 151, 138)',
  'su-green-dark': 'rgb(92, 121, 108)',
  'su-pink': 'rgb(206, 88, 152)',
  'su-blue': 'rgb(143, 195, 216)',
  'su-blue-game': 'rgb(125, 206, 235)',
  'su-blue-light': 'rgb(199, 223, 231)',
  'su-blue-pale': 'rgb(230, 240, 245)',
  'su-brick': 'rgb(168, 89, 71)',
  'su-brick-pale': 'rgb(210, 160, 140)',
  'su-black': 'rgb(40, 32, 25)',
  'su-white': 'rgb(251, 248, 243)',
  'su-grey': 'rgb(150, 150, 150)',
  'su-grey-light': 'rgb(199, 199, 199)',
  'su-grey-medium': 'rgb(130, 130, 130)',
  'su-grey-dark': 'rgb(80, 80, 80)',
  'su-input-bg': 'rgb(232, 229, 216)',
  'su-input-text': 'rgb(45, 62, 54)',
  'su-peach': 'rgb(245, 193, 163)',
  'su-sickly-yellow': 'rgb(215, 195, 125)',
  'su-silver': 'rgb(192, 192, 192)',
}

const techLevelColors: Record<string, string> = {
  '1': 'rgb(115, 201, 230)',
  '2': 'rgb(87, 169, 200)',
  '3': 'rgb(68, 135, 162)',
  '4': 'rgb(48, 107, 128)',
  '5': 'rgb(30, 83, 100)',
  '6': 'rgb(6, 52, 65)',
}

const semanticColors: Record<string, string> = {
  pilot: 'var(--color-pilot)',
  'pilot-light': 'var(--color-pilot-light)',
  mech: 'var(--color-mech)',
  'mech-dark': 'var(--color-mech-dark)',
  crawler: 'var(--color-crawler)',
}

const rollColors: Record<string, string> = {
  'roll-cascade': 'rgb(244, 67, 54)',
  'roll-failure': 'rgb(255, 152, 0)',
  'roll-tough': 'rgb(255, 193, 7)',
  'roll-success': 'rgb(76, 175, 80)',
  'roll-nailed': 'rgb(33, 150, 243)',
}

const cssVarMappings: Record<string, string> = {
  '--background': 'var(--color-su-white)',
  '--foreground': 'var(--color-su-black)',
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
      SU Brand Color Palette
    </h2>
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem' }}>
      {Object.entries(brandColors).map(([name, value]) => (
        <Swatch key={name} name={name} color={value} />
      ))}
    </div>
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
