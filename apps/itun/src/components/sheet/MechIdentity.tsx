/**
 * MechIdentityPanel — the mech poster's IDENTITY card body (the
 * mech sibling of PilotIdentityPanel). The PATTERN NAME is the prominent
 * identity field — a mech's name and its pattern name are the same field
 * (redesign refinement), so the field displays the canonical `mech.name` and
 * saving writes `name` and `patternName` in lockstep. The chassis and Tech
 * Level render as labeled secondary meta.
 *
 * FIELD-section archetype (unified edit language). The parent
 * `SheetSectionCard`'s header owns the section's Edit/Done button, so this
 * panel is CONTROLLED via the `editing` prop rather than owning its own toggle
 * state, mirroring
 * `PilotIdentityPanel`. Chassis is picker-backed — its edit affordance opens
 * the existing MechChassisPickerModal (destructive: swapping chassis clears
 * the loadout, with its own confirm step).
 *
 * // TODO(redesign): the mockup also shows a "Source pattern" meta line (the
 * // published pattern this mech was templated from) and a "Save as pattern"
 * // header control — both need a new stored field / feature and are
 * // deliberately omitted rather than rendered dead.
 */

import { Field, tokens } from 'component-lib'
import type { Mech } from 'itun-domain/schemas/mech'
import type { CSSProperties, ReactNode } from 'react'
import { useState } from 'react'
import { MechChassisPickerModal } from '../mech/MechChassisPickerModal'
import type { SheetPatch } from './sheetViewProps.model'

const PANEL = { minWidth: 0 } satisfies CSSProperties

const STACK = {
  display: 'flex',
  flexDirection: 'column',
  gap: tokens.space[12],
  minWidth: 0,
} satisfies CSSProperties

/** Chassis + Quirk; the row splits in two at sm (`.su-sheet-mech-chassis-row`). */
const CHASSIS_ROW = {
  columnGap: tokens.space[16],
  display: 'grid',
  rowGap: tokens.space[12],
} satisfies CSSProperties

type MechIdentityPanelProps = {
  mech: Mech
  /** Resolved chassis display name (falls back to the raw ref upstream). */
  chassisName: string
  /** Chassis tech level; undefined renders as an em-dash. */
  /**
   * Section-level edit flag, owned by the parent `SheetSectionCard`'s header
   * Edit/Done button (the chead row lives in the card, not here).
   */
  /** Partial merge on this mech; omit on read-only sheets (no edit affordance). */
  patch?: SheetPatch
  /**
   * Content below the chassis field (the chassis ability, which carries the
   * chassis stats in its own header). The chassis NAME reads first and the
   * card that elaborates it follows — same subject, in reading order.
   */
  after?: ReactNode
  /**
   * The field sharing the chassis's row (the mech's Quirk). Both are one-line
   * values, so pairing them uses the row the half-width chassis field left
   * empty rather than spending a whole row on each.
   */
  besideChassis?: ReactNode
  className?: string
}

export function MechIdentityPanel({
  mech,
  chassisName,
  patch,
  after,
  besideChassis,
  className,
}: MechIdentityPanelProps) {
  const [chassisPickerOpen, setChassisPickerOpen] = useState(false)

  const canEdit = patch !== undefined

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

  /** Confirmed chassis swap — destructive: clears the installed loadout. */
  function changeChassis(chassisRef: string) {
    patch?.({ chassisRef, systems: [], modules: [] })
  }

  return (
    <section aria-label="Mech identity" className={className} style={PANEL}>
      <div style={STACK}>
        {/* The prominent identity: pattern name (== the mech's name). */}
        <Field
          label="Pattern Name"
          value={mech.name}
          onSave={canEdit ? savePatternName : undefined}
          prominent
        />
        {/* Chassis (picker-backed). Tech Level is NOT here: it is inherent to
            the chassis, never hand-set, and rendering it as a Field made it look
            editable. It reads off the Chassis Stats strip instead, with the
            rest of the chassis-derived numbers. */}
        {/* Half width: the chassis is a one-word picker value, and a full-bleed
            box for it competed with the pattern name above. */}
        <div className="su-sheet-mech-chassis-row" style={CHASSIS_ROW}>
          <Field
            label="Chassis"
            value={chassisName}
            onEditClick={canEdit ? () => setChassisPickerOpen(true) : undefined}
          />
          {besideChassis}
        </div>
        {after}
      </div>

      {/* Chassis swap — the existing confirmed destructive picker flow. */}
      <MechChassisPickerModal
        open={chassisPickerOpen}
        currentChassisRef={mech.chassisRef}
        onOpenChange={setChassisPickerOpen}
        onConfirm={changeChassis}
      />
    </section>
  )
}
