/**
 * MechIdentityPanel — the mech hero's IDENTITY fields (the mech sibling of
 * PilotIdentityPanel): what the player wrote. The chassis's stats and ability
 * sit beside them in the hero; its name, art and description are its callout
 * at the hero card's foot (`MechChassisCard`).
 *
 * The PATTERN NAME is the band's title, so Read leaves it out (owner's call,
 * 2026-10-14) and Edit shows it as the name's edit surface, as the pilot's
 * Name. A mech's name and its pattern name are the same field, so it displays
 * the canonical `mech.name` and saving writes `name` and `patternName` in
 * lockstep.
 *
 * // TODO(redesign): the mockup also shows a "Source pattern" meta line (the
 * // published pattern this mech was templated from) and a "Save as pattern"
 * // header control — both need a new stored field / feature and are
 * // deliberately omitted rather than rendered dead.
 */

import type { Mech } from 'cantina-domain/schemas/mech'
import type { CSSProperties, ReactNode } from 'react'
import { Field, tokens } from '../../../ui/index'
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
        {/* Read omits the pattern name: it is the band's title. */}
        {patch && (
          <Field label="Pattern name" value={mech.name} onSave={savePatternName} prominent />
        )}
        {after}
      </div>
    </section>
  )
}

type MechProseFieldsProps = {
  mech: Mech
  /** Field saves; omit on read-only sheets (no edit affordance). */
  saveAppearance?: (next: string) => void
  saveDescription?: (next: string) => void
}

/**
 * The mech's prose fields, spanning the identity card under the pattern name
 * and Quirk. The Description closes the card and takes whatever height the
 * slab has left (the identity slab stretches to match the vitals beside it,
 * and that space should go to a field the reader can use rather than sitting
 * as dead paper), as the pilot's Bio does.
 */
export function MechProseFields({ mech, saveAppearance, saveDescription }: MechProseFieldsProps) {
  return (
    <>
      <Field
        label="Appearance"
        value={mech.appearance ?? ''}
        multiline
        onSave={saveAppearance}
        placeholder="No appearance recorded."
      />
      <Field
        label="Description"
        value={mech.description ?? ''}
        multiline
        fill
        onSave={saveDescription}
        placeholder="No description written yet."
        className="su-sheet-mech-fill"
      />
    </>
  )
}
