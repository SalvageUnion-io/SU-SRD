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
import type { SURefClass } from 'salvageunion-reference'
import { Btn } from 'suref-react'

import { resolveClassName } from '../../lib/classRef'
import type { Pilot } from '../../lib/schemas/pilot'
import { cn } from '../../lib/utils'
import { ClassDetail, ClassOptionList } from '../pilot/ClassStep'
import { selectableClasses } from '../pilot/classOptions'
import { IdentityField } from './IdentityField'
import { SheetPickerModal } from './SheetSection'
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
  const base =
    'inline-flex min-h-[28px] items-center gap-1.5 rounded-full border-2 py-[4px] pl-[6px] pr-[10px] font-cond text-[9.5px] font-bold uppercase leading-none tracking-caps-wide'
  const dot = (
    <span
      aria-hidden="true"
      className={cn(
        'h-3 w-3 shrink-0 rounded-full border-2 border-current',
        used &&
          'border-[color:var(--tone,var(--color-su-orange))] bg-[var(--tone,var(--color-su-orange))]'
      )}
    />
  )
  if (!onToggle) {
    if (!used) return null
    return (
      <span className={cn(base, 'border-ink bg-ink text-paper')}>
        {dot}
        Used
      </span>
    )
  }
  return (
    <button
      type="button"
      aria-pressed={used}
      aria-label={used ? `Reset ${label} used` : `Mark ${label} used`}
      onClick={() => onToggle(!used)}
      className={cn(
        base,
        'cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rust/40',
        used
          ? 'border-ink bg-ink text-paper'
          : 'border-ink/55 bg-paper text-ink/55 hover:border-ink hover:text-ink'
      )}
    >
      {dot}
      Used
    </button>
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
  const selectedClass = allClasses.find((c) => c.id === pendingClass) as SURefClass | undefined

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
          <IdentityField
            label="Name"
            value={pilot.name}
            editing={isEditing}
            onSave={saveRequired('name')}
          />
          <IdentityField
            label="Callsign"
            value={pilot.callsign}
            editing={isEditing}
            onSave={saveRequired('callsign')}
          />
          <IdentityField
            label="Class"
            value={resolveClassName(pilot.classRef)}
            editing={isEditing}
            onEditClick={openClassPicker}
          />
          <IdentityField
            label="Appearance"
            value={pilot.appearance}
            editing={isEditing}
            multiline
            onSave={saveText('appearance')}
          />
        </div>
        <div className="flex min-w-0 flex-col gap-3">
          <IdentityField
            label="Motto"
            value={pilot.motto}
            editing={isEditing}
            multiline
            onSave={saveText('motto')}
            labelAction={usedChip('motto', 'motto')}
          />
          <IdentityField
            label="Keepsake"
            value={pilot.keepsake}
            editing={isEditing}
            multiline
            onSave={saveText('keepsake')}
            labelAction={usedChip('keepsake', 'keepsake')}
          />
          <IdentityField
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
        <IdentityField
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
            <Btn variant="ghost" size="sm" onClick={() => setClassPickerOpen(false)}>
              Cancel
            </Btn>
            <Btn variant="primary" size="sm" onClick={confirmClass}>
              Change Class
            </Btn>
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
