import type { CSSProperties } from 'react'
import { useState } from 'react'
import { borderWidth, color, font, fontSize, radius, space, weight } from '../../design/tokens'
import type { Story } from '../../stories/_harness'
import { Caption } from '../../stories/_harness'
import type { CSSVarStyle } from '../../styles/cssVars'
import { ModeDoor } from './ModeDoor'
import { Sel } from './Sel'

export default {
  title: 'Atoms/Mode Door',
}

// The doors read `--tone` (plate fill) and `--ground` (halo gap) from the sheet
// surface; stand them in inline for the story.
const SURFACE: CSSVarStyle = {
  '--tone': '#b8532a',
  '--ground': '#f3ece2',
  background: 'var(--ground)',
  padding: space[32],
}

/** One column, two from Tailwind's `sm` (40rem) up: `.su-story-door-grid`. */
const DOORS = { display: 'grid', gap: space[24], marginTop: space[16] } satisfies CSSProperties

const CUSTOM_BUILD = {
  backgroundColor: color.paper,
  borderColor: color.ink,
  borderRadius: radius.panel,
  borderStyle: 'solid',
  borderWidth: borderWidth.chrome,
  color: color.ink,
  fontFamily: font.cond,
  fontSize: fontSize.lg,
  fontWeight: weight.bold,
  lineHeight: 'calc(1.75 / 1.125)',
  paddingBlock: space[12],
  paddingInline: space[16],
  textTransform: 'uppercase',
} satisfies CSSProperties

/** The two onboarding doors side by side, plus the ink-double Sel ring. */
export const Default: Story = () => {
  const [chosen, setChosen] = useState<string | null>(null)
  return (
    <div style={SURFACE}>
      <Caption>
        Guided (filled tone + double-ink halo) and Blank (dashed paper escape hatch). Chosen:{' '}
        {chosen ?? 'none'}
      </Caption>
      <div className="su-story-door-grid" style={DOORS}>
        <ModeDoor
          variant="guided"
          tab="▶"
          headline="Guided"
          cite="The Pilot Bay begins on p. 18."
          onSelect={() => setChosen('guided')}
        >
          Step through the Pilot Bay rules, one card at a time — class, abilities, equipment,
          identity.
        </ModeDoor>
        <ModeDoor
          variant="blank"
          tab="✎"
          headline="Blank"
          cite="For veterans, imports, and homebrew."
          onSelect={() => setChosen('blank')}
        >
          An empty sheet. No steps, no limits. Fill it in on the live sheet.
        </ModeDoor>
      </div>

      <div style={{ marginTop: space[32] }}>
        <Caption>Sel ring="ink-double" — the custom-build door's selection halo.</Caption>
      </div>
      <div style={{ marginTop: space[12], width: 'fit-content' }}>
        <Sel selected ring="ink-double" ariaLabel="Custom build" onToggle={() => {}}>
          <div style={CUSTOM_BUILD}>Custom Build</div>
        </Sel>
      </div>
    </div>
  )
}
