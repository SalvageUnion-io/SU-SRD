/**
 * MechIdentityPanel — the mech poster's IDENTITY card body (redesign Phase 2,
 * the mech sibling of PilotIdentityPanel). The PATTERN NAME is the prominent
 * identity field — a mech's name and its pattern name are the same field
 * (redesign refinement), so the field displays the canonical `mech.name` and
 * saving writes `name` and `patternName` in lockstep. The chassis and Tech
 * Level render as labeled secondary meta.
 *
 * FIELD-section archetype (unified edit language), but the section's own
 * Edit/Done button now lives in the parent `SheetSectionCard`'s header (Phase
 * 2 lifts the chead row into the card chrome) — this panel is CONTROLLED via
 * the `editing` prop rather than owning its own toggle state, mirroring
 * `PilotIdentityPanel`. Chassis is picker-backed — its edit affordance opens
 * the existing MechChassisPickerModal (destructive: swapping chassis clears
 * the loadout, with its own confirm step).
 *
 * // TODO(redesign): the mockup also shows a "Source pattern" meta line (the
 * // published pattern this mech was templated from) and a "Save as pattern"
 * // header control — both need a new stored field / feature and are
 * // deliberately omitted rather than rendered dead.
 */

import { useState } from 'react'

import type { Mech } from '../../lib/schemas/mech'
import { cn } from '../../lib/utils'
import { MechChassisPickerModal } from '../mech/MechChassisPickerModal'
import { Field } from 'component-lib'
import type { SheetPatch } from './sheetViewProps'

type MechIdentityPanelProps = {
  mech: Mech
  /** Resolved chassis display name (falls back to the raw ref upstream). */
  chassisName: string
  /** Chassis tech level; undefined renders as an em-dash. */
  techLevel?: number
  /**
   * Section-level edit flag, owned by the parent `SheetSectionCard`'s header
   * Edit/Done button (Phase 2: the chead row lives in the card, not here).
   */
  editing?: boolean
  /** Partial merge on this mech; omit on read-only sheets (no edit affordance). */
  patch?: SheetPatch
  className?: string
}

export function MechIdentityPanel({
  mech,
  chassisName,
  techLevel,
  editing = false,
  patch,
  className,
}: MechIdentityPanelProps) {
  const [chassisPickerOpen, setChassisPickerOpen] = useState(false)

  const canEdit = patch !== undefined
  const isEditing = editing && canEdit

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
    <section aria-label="Mech identity" className={cn('min-w-0', className)}>
      <div className="flex min-w-0 flex-col gap-3">
        {/* The prominent identity: pattern name (== the mech's name). */}
        <Field
          label="Pattern Name"
          value={mech.name}
          editing={isEditing}
          onSave={savePatternName}
        />
        {/* Secondary meta: chassis (picker-backed) + Tech Level (derived). */}
        <div className="grid grid-cols-1 gap-x-4 gap-y-3 sm:grid-cols-2">
          <Field
            label="Chassis"
            value={chassisName}
            editing={isEditing}
            onEditClick={() => setChassisPickerOpen(true)}
          />
          <Field label="Tech Level" value={techLevel !== undefined ? String(techLevel) : ''} />
        </div>
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
