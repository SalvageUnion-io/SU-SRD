/**
 * MechIdentityPanel — the mech hero's IDENTITY card body (the mech sibling
 * of PilotIdentityPanel): only what the player wrote. The chassis — its name,
 * stats and ability — is its own card under the hero (`MechChassisCard`).
 *
 * The PATTERN NAME is the prominent identity field — a mech's name and its
 * pattern name are the same field (redesign refinement), so the field
 * displays the canonical `mech.name` and saving writes `name` and
 * `patternName` in lockstep.
 *
 * // TODO(redesign): the mockup also shows a "Source pattern" meta line (the
 * // published pattern this mech was templated from) and a "Save as pattern"
 * // header control — both need a new stored field / feature and are
 * // deliberately omitted rather than rendered dead.
 */

import { Field, tokens } from 'component-lib'
import type { Mech } from 'itun-domain/schemas/mech'
import type { CSSProperties, ReactNode } from 'react'
import type { SheetPatch } from './sheetViewProps.model'

const PANEL = { minWidth: 0 } satisfies CSSProperties

const STACK = {
  display: 'flex',
  flexDirection: 'column',
  gap: tokens.space[12],
  minWidth: 0,
} satisfies CSSProperties

type MechIdentityPanelProps = {
  mech: Mech
  /** Partial merge on this mech; omit on read-only sheets (no edit affordance). */
  patch?: SheetPatch
  /** The player's other one-line fields under the pattern name (the Quirk). */
  after?: ReactNode
}

export function MechIdentityPanel({ mech, patch, after }: MechIdentityPanelProps) {
  /**
   * Persist the pattern name (required — never write empty). Name and pattern
   * name are the same field per the redesign, so both stored fields are kept
   * in lockstep: `name` stays the canonical identity every other surface
   * (dashboard, rails, back links) reads.
   */
  function savePatternName(next: string) {
    const trimmed = next.trim()
    if (trimmed) patch?.({ name: trimmed, patternName: trimmed })
  }

  return (
    <section aria-label="Mech identity" style={PANEL}>
      <div style={STACK}>
        <Field
          label="Pattern name"
          value={mech.name}
          onSave={patch ? savePatternName : undefined}
          prominent
        />
        {after}
      </div>
    </section>
  )
}
