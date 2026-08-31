/* Ported from packages/component-lib/src/components/chrome/ModeDoor.stories.tsx. */
import { ModeDoor, Sel } from 'component-lib'
import type { CSSProperties } from 'react'
import { Caption } from '../preview-lib/harness'

// The doors read `--tone` (plate fill) and `--ground` (halo gap) from the sheet
// surface they sit on; stood in inline here, as the story does.
const SURFACE = {
  '--tone': '#b8532a',
  '--ground': '#f3ece2',
  background: 'var(--ground)',
} as CSSProperties

/**
 * The two onboarding doors. `guided` is a filled tone plate with a double-ink
 * halo; `blank` is the dashed paper escape hatch beside it.
 */
export function Doors() {
  return (
    <div style={SURFACE} className="p-8">
      <Caption>guided (filled tone) and blank (dashed escape hatch)</Caption>
      <div className="mt-4 grid grid-cols-1 gap-6 sm:grid-cols-2">
        <ModeDoor
          variant="guided"
          tab="▶"
          headline="Guided"
          cite="The Pilot Bay begins on p. 18."
          onSelect={() => {}}
        >
          Step through the Pilot Bay rules, one card at a time — class, abilities, equipment,
          identity.
        </ModeDoor>
        <ModeDoor
          variant="blank"
          tab="✎"
          headline="Blank"
          cite="For veterans, imports, and homebrew."
          onSelect={() => {}}
        >
          An empty sheet. No steps, no limits. Fill it in on the live sheet.
        </ModeDoor>
      </div>
    </div>
  )
}

/** The custom-build door's selection halo — `Sel ring="ink-double"`. */
export function SelectionHalo() {
  return (
    <div style={SURFACE} className="p-8">
      <Caption>Sel ring=&quot;ink-double&quot;</Caption>
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
