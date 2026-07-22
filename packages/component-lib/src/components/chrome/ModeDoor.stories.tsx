import type { Story } from '@ladle/react'
import { useState } from 'react'
import type { CSSProperties } from 'react'
import { Caption } from '../../stories/_harness'
import { ModeDoor } from './ModeDoor'
import { Sel } from './Sel'

export default {
  title: 'Atoms/Mode Door',
}

// The doors read `--tone` (plate fill) and `--ground` (halo gap) from the sheet
// surface; stand them in inline for the story.
const SURFACE: CSSProperties = {
  '--tone': '#b8532a',
  '--ground': '#f3ece2',
  background: 'var(--ground)',
} as CSSProperties

/** The two onboarding doors side by side, plus the ink-double Sel ring. */
export const Default: Story = () => {
  const [chosen, setChosen] = useState<string | null>(null)
  return (
    <div style={SURFACE} className="p-8">
      <Caption>
        Guided (filled tone + double-ink halo) and Blank (dashed paper escape hatch). Chosen:{' '}
        {chosen ?? 'none'}
      </Caption>
      <div className="mt-4 grid grid-cols-1 gap-6 sm:grid-cols-2">
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

      <div className="mt-8">
        <Caption>Sel ring="ink-double" — the custom-build door's selection halo.</Caption>
      </div>
      <div className="mt-3 w-fit">
        <Sel selected ring="ink-double" ariaLabel="Custom build" onToggle={() => {}}>
          <div className="rounded-panel border-chrome border-ink bg-paper px-4 py-3 font-cond text-lg font-bold uppercase text-ink">
            Custom Build
          </div>
        </Sel>
      </div>
    </div>
  )
}
