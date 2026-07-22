/**
 * PilotIdentityPanel — the pilot poster's IDENTITY card body (redesign Phase
 * 2): the poster's labeled fields — Name / Callsign / Class / Appearance
 * (left) and Motto / Keepsake / Background with their once-per-Downtime USED
 * toggles (rules A8–A10) on the right, plus a folded-in Bio field (#409 — the
 * dropped live-play Bio section's data still needs a home) — rendered via the
 * shared IdentityField primitive.
 *
 * FIELD-section archetype (unified edit language), but the section's own
 * Edit/Done button now lives in the parent `SheetSectionCard`'s header (Phase
 * 2 lifts the chead row into the card chrome) — this panel is CONTROLLED via
 * the `editing` prop rather than owning its own toggle state. Class is
 * picker-backed — its edit affordance opens the ONE shared picker modal with
 * the wizard's master-detail class list (changing class KEEPS abilities,
 * matching the old edit-mode semantics).
 *
 * readOnly (no onToggleUsed / no patch): used chips render as static 'USED'
 * stamps only when set, and `editing` has no effect (no patch means no edit
 * affordance renders regardless).
 */

import { useState } from 'react'
import { Badge, Button } from 'component-lib'

import { resolveClassName } from '../../lib/classRef'
import type { Pilot } from '../../lib/schemas/pilot'
import { cn } from '../../lib/utils'
import { ClassDetail, ClassOptionList } from 'component-lib'
import { selectableClasses } from 'component-lib'
import { Field } from 'component-lib'
import { SheetPickerModal } from 'component-lib'
import type { SheetPatch } from './sheetViewProps'

export type UsedToggleKey = 'background' | 'motto' | 'keepsake'

// ---------------------------------------------------------------------------
// Used chip (once-per-Downtime toggles, rules A8–A10) — live-play control,
// always available while editable (not gated behind the section edit).
// ---------------------------------------------------------------------------

/** Round `.used` pill toggle (poster design-spec): hollow leading dot, ON =
 * ink fill + white text + accent-filled dot. */
function UsedChip({
  label,
  used,
  onToggle,
}: {
  label: string
  used: boolean
  onToggle?: (next: boolean) => void
}) {
  // Hollow leading dot; ON = tone-filled. Rendered as the chip's leading child
  // (Badge's `swatch` is a square colour plate, so the round toggle dot rides
  // as `children` with an explicit gap).
  const dot = (
    <span
      aria-hidden="true"
      className={cn(
        'h-3 w-3 shrink-0 rounded-full border-2 border-current',
        used && 'border-[color:var(--tone,var(--color-pilot))] bg-[var(--tone,var(--color-pilot))]'
      )}
    />
  )
  if (!onToggle) {
    // Read-only: a static 'USED' stamp, shown only when set.
    if (!used) return null
    return (
      <Badge shape="chip" surface="solid" className="gap-1.5">
        {dot}
        Used
      </Badge>
    )
  }
  // Interactive: the Badge aria-pressed toggle pattern — solid when pressed,
  // ghost when not; Badge supplies cursor + focus ring.
  return (
    <Badge
      as="button"
      shape="chip"
      surface={used ? 'solid' : 'ghost'}
      aria-pressed={used}
      aria-label={used ? `Reset ${label} used` : `Mark ${label} used`}
      onClick={() => onToggle(!used)}
      className="gap-1.5"
    >
      {dot}
      Used
    </Badge>
  )
}

// ---------------------------------------------------------------------------
// Identity panel
// ---------------------------------------------------------------------------

type PilotIdentityPanelProps = {
  pilot: Pilot
  /**
   * Section-level edit flag, owned by the parent `SheetSectionCard`'s header
   * Edit/Done button (Phase 2: the chead row lives in the card, not here).
   */
  editing?: boolean
  /** Persist a used-flag change; omit on read-only sheets (static stamps). */
  onToggleUsed?: (key: UsedToggleKey, next: boolean) => void
  /** Partial merge on this pilot; omit on read-only sheets (no edit affordance). */
  patch?: SheetPatch
  className?: string
}

export function PilotIdentityPanel({
  pilot,
  editing = false,
  onToggleUsed,
  patch,
  className,
}: PilotIdentityPanelProps) {
  const [classPickerOpen, setClassPickerOpen] = useState(false)
  // Class picker holds a pending selection until confirmed (destructive-ish:
  // it re-homes the pilot's class; abilities are intentionally kept).
  const [pendingClass, setPendingClass] = useState<string>(pilot.classRef)

  // Resolved lazily — only once the picker opens — so read-only/snapshot
  // renders never touch the (possibly unloaded) reference class catalog.
  const { base, specialisations } = classPickerOpen
    ? selectableClasses(undefined, true)
    : { base: [], specialisations: [] }
  const allClasses = [...base, ...specialisations]
  const selectedClass = allClasses.find((c) => c.id === pendingClass)

  const canEdit = patch !== undefined
  const isEditing = editing && canEdit

  /** Persist a trimmed freeform field (empty allowed). */
  const saveText = (field: keyof Pilot) => (next: string) => {
    patch?.({ [field]: next.trim() })
  }
  /** Persist a required (z.string().min(1)) field — never write empty. */
  const saveRequired = (field: keyof Pilot) => (next: string) => {
    const trimmed = next.trim()
    if (trimmed) patch?.({ [field]: trimmed })
  }

  function openClassPicker() {
    setPendingClass(pilot.classRef)
    setClassPickerOpen(true)
  }

  function confirmClass() {
    if (pendingClass && pendingClass !== pilot.classRef) {
      patch?.({ classRef: pendingClass })
    }
    setClassPickerOpen(false)
  }

  const usedChip = (key: UsedToggleKey, label: string) => (
    <UsedChip
      label={label}
      used={pilot.usedToggles?.[key] ?? false}
      onToggle={onToggleUsed ? (next) => onToggleUsed(key, next) : undefined}
    />
  )

  return (
    <div className={cn('min-w-0', className)}>
      {/* Poster field grid — left / right columns; single column on mobile in
          the poster's reading order. */}
      <div className="grid grid-cols-1 gap-x-4 gap-y-3 sm:grid-cols-2">
        <div className="flex min-w-0 flex-col gap-3">
          {/* Name lives here too: with the global Edit toggle gone, this is
              the pilot's name edit surface (the hero title mirrors it). */}
          <Field
            label="Name"
            value={pilot.name}
            editing={isEditing}
            onSave={saveRequired('name')}
          />
          <Field
            label="Callsign"
            value={pilot.callsign}
            editing={isEditing}
            onSave={saveRequired('callsign')}
          />
          <Field
            label="Class"
            value={resolveClassName(pilot.classRef)}
            editing={isEditing}
            onEditClick={openClassPicker}
          />
          <Field
            label="Appearance"
            value={pilot.appearance}
            editing={isEditing}
            multiline
            onSave={saveText('appearance')}
          />
        </div>
        <div className="flex min-w-0 flex-col gap-3">
          <Field
            label="Motto"
            value={pilot.motto}
            editing={isEditing}
            multiline
            onSave={saveText('motto')}
            labelAction={usedChip('motto', 'motto')}
          />
          <Field
            label="Keepsake"
            value={pilot.keepsake}
            editing={isEditing}
            multiline
            onSave={saveText('keepsake')}
            labelAction={usedChip('keepsake', 'keepsake')}
          />
          <Field
            label="Background"
            value={pilot.background}
            editing={isEditing}
            multiline
            onSave={saveText('background')}
            labelAction={usedChip('background', 'background')}
          />
        </div>
      </div>

      {/* Bio — folded in from the dropped live-play Bio section (#409): the
          freeform backstory previously rendered via SheetDescription now
          lives as an extra full-width identity field. */}
      <div className="mt-3">
        <Field
          label="Bio"
          value={pilot.description ?? ''}
          editing={isEditing}
          multiline
          onSave={saveText('description')}
          placeholder="No bio written yet."
        />
      </div>

      {/* Class — single-select master-detail in the ONE shared picker modal. */}
      <SheetPickerModal
        open={classPickerOpen}
        onClose={() => setClassPickerOpen(false)}
        title="Change Class"
        footer={
          <>
            <Button variant="ghost" size="compact" onClick={() => setClassPickerOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" size="compact" onClick={confirmClass}>
              Change Class
            </Button>
          </>
        }
      >
        <div className="grid gap-4 sm:grid-cols-[minmax(0,320px)_1fr]">
          <ClassOptionList
            base={base}
            specialisations={specialisations}
            selectedClassId={pendingClass}
            onSelect={setPendingClass}
          />
          <ClassDetail selectedClass={selectedClass} />
        </div>
      </SheetPickerModal>
    </div>
  )
}
