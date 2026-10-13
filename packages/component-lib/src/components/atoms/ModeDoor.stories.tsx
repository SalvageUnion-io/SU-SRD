import type { CSSProperties } from 'react'
import { useState } from 'react'
import { space } from '../../design/tokens'
import type { Story } from '../../stories/_harness'
import { Caption } from '../../stories/_harness'
import { ModeDoor } from './ModeDoor'

export default {
  title: 'Atoms/Mode Door',
}

// The doors read the sheet surface: `--tone-band` / `--on-tone-band` (the
// guided plate and its text) and `--ground` (the halo gap). The story renders
// them on each real `.sheet--*` class, so a tone that fails its text shows here.
const SURFACE = { background: 'var(--ground)', padding: space[32] } satisfies CSSProperties

const SHEETS = ['pilot', 'mech', 'crawler'] as const

/** One column, two from the `sm` breakpoint (40rem) up: `.su-story-door-grid`. */
const DOORS = { display: 'grid', gap: space[24], marginTop: space[16] } satisfies CSSProperties

/** The two onboarding doors side by side on each sheet. */
export const Default: Story = () => {
  const [chosen, setChosen] = useState<string | null>(null)
  return (
    <div>
      {SHEETS.map((sheet) => (
        <div key={sheet} className={`sheet--${sheet}`} style={SURFACE}>
          <Caption>
            .sheet--{sheet}: Guided (filled tone band + double-ink halo) and Blank (dashed paper
            escape hatch). Chosen: {chosen ?? 'none'}
          </Caption>
          <div className="su-story-door-grid" style={DOORS}>
            <ModeDoor
              variant="guided"
              tab="▶"
              headline="Guided"
              cite="The Pilot Bay begins on p. 18."
              onSelect={() => setChosen(`${sheet} guided`)}
            >
              Step through the Pilot Bay rules, one card at a time — class, abilities, equipment,
              identity.
            </ModeDoor>
            <ModeDoor
              variant="blank"
              tab="✎"
              headline="Blank"
              cite="For veterans, imports, and homebrew."
              onSelect={() => setChosen(`${sheet} blank`)}
            >
              An empty sheet. No steps, no limits. Fill it in on the live sheet.
            </ModeDoor>
          </div>
        </div>
      ))}
    </div>
  )
}
