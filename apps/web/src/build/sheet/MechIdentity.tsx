/**
 * MechIdentityPanel — the mech's IDENTITY fields in Edit (the mech sibling of
 * PilotIdentityPanel): what the player wrote, on the dashboard's masthead
 * under the board (`MechDash`).
 *
 * The PATTERN NAME is the band's title, so Read leaves it out and Edit shows
 * it as the name's edit surface, as the pilot's
 * Name. A mech's name is its pattern's name, so it displays and saves
 * `mech.name`; `patternName` is the book pattern it started from, provenance
 * a rename never touches.
 */

import type { Mech } from 'game-domain/schemas/mech'
import type { CSSProperties, ReactNode } from 'react'
import { Field, tokens } from '../../components/index'
import { buildSheetCopy } from '../../messages/build-sheet'
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
  /** Persist the mech's (and so its pattern's) name; never write empty. */
  function savePatternName(next: string) {
    const trimmed = next.trim()
    if (trimmed) patch?.({ name: trimmed })
  }

  return (
    <section aria-label={buildSheetCopy('mechIdentity')} style={PANEL}>
      <div style={STACK}>
        {/* Read omits the pattern name: it is the band's title. */}
        {patch && (
          <Field
            label={buildSheetCopy('patternName')}
            value={mech.name}
            onSave={savePatternName}
            prominent
          />
        )}
        {after}
      </div>
    </section>
  )
}

/** The mech's Appearance: one of the player's short fields. */
export function MechAppearanceField({
  mech,
  onSave,
}: {
  mech: Mech
  /** Omit on read-only sheets (no edit affordance). */
  onSave?: (next: string) => void
}) {
  return (
    <Field
      label={buildSheetCopy('appearance')}
      value={mech.appearance ?? ''}
      multiline
      onSave={onSave}
      placeholder={buildSheetCopy('noAppearanceRecorded')}
    />
  )
}

/** The mech's Description: the long prose, under the player's short fields. */
export function MechDescriptionField({
  mech,
  onSave,
}: {
  mech: Mech
  /** Omit on read-only sheets (no edit affordance). */
  onSave?: (next: string) => void
}) {
  return (
    <Field
      label={buildSheetCopy('description')}
      value={mech.description ?? ''}
      multiline
      fill
      onSave={onSave}
      placeholder={buildSheetCopy('noDescriptionWrittenYet')}
      className="su-sheet-mech-fill"
    />
  )
}
