/* Ported from packages/component-lib/src/components/shared/RuleBrief.stories.tsx. */
import { RuleBrief } from 'component-lib'
import type { CSSProperties } from 'react'
import { Caption } from '../preview-lib/harness'

// Themed via --tone / --tone-deep, the same route the live sheets use.
const MECH_TONE = {
  '--tone': 'var(--color-mech)',
  '--tone-deep': 'var(--color-sheet-mech-deep)',
} as CSSProperties
const PILOT_TONE = {
  '--tone': 'var(--color-pilot)',
  '--tone-deep': 'var(--color-sheet-pilot-deep)',
} as CSSProperties

/**
 * The "THE RULE" callout every wizard step opens with — rule text on paper,
 * citation in the footer. Composes `SheetSectionCard`.
 */
export function MechRule() {
  return (
    <div style={MECH_TONE} className="flex flex-col gap-3 bg-paper p-4">
      <Caption>a mech-toned step</Caption>
      <RuleBrief
        rule="A Mech's Chassis sets its Structure Points, Energy Points, Heat Capacity, and its System and Module slots. Pick a Chassis before fitting any systems."
        cite="Core Book · p.94"
      />
    </div>
  )
}

/** The same callout on a pilot step — the tone comes from the host surface. */
export function PilotRule() {
  return (
    <div style={PILOT_TONE} className="flex flex-col gap-3 bg-paper p-4">
      <Caption>a pilot-toned step</Caption>
      <RuleBrief
        rule="Every Pilot begins with a Class. The Class sets your starting Abilities and the trees you may advance through as you gain Levels."
        cite="Core Book · p.18"
      />
    </div>
  )
}
