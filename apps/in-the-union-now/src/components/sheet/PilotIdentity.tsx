/**
 * PilotIdentityPanel — the pilot hero's IDENTITY block (redesign Task B):
 * the poster's labeled fields — Name / Callsign / Class / Appearance (left)
 * and Motto / Keepsake / Background with their once-per-Downtime USED toggles
 * (rules A8–A10) on the right — rendered via the shared IdentityField
 * primitive.
 *
 * FIELD-section archetype (unified edit language): the panel owns its OWN
 * Edit button; fields render read-only by default and flip to inline
 * click-to-edit only while this section is editing. Class is picker-backed —
 * its edit affordance opens the ONE shared picker modal with the wizard's
 * master-detail class list (changing class KEEPS abilities, matching the old
 * edit-mode semantics).
 *
 * readOnly (no onToggleUsed / no patch): used chips render as static 'USED'
 * stamps only when set, and no Edit button renders.
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
import { SectionEditButton, SheetPickerModal } from './SheetSection'
import type { SheetPatch } from './sheetViewProps'

export type UsedToggleKey = 'background' | 'motto' | 'keepsake'

// ---------------------------------------------------------------------------
// Used chip (once-per-Downtime toggles, rules A8–A10) — live-play control,
// always available while editable (not gated behind the section edit).
// ---------------------------------------------------------------------------

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
    'inline-flex items-center rounded-[2px] px-[7px] pb-[1px] pt-[2px] font-cond text-label font-semibold uppercase leading-tight tracking-caps-snug'
  if (!onToggle) {
    if (!used) return null
    return <span className={cn(base, 'bg-ink text-paper')}>Used</span>
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
          ? 'bg-ink text-paper'
          : 'border border-dashed border-ink/50 bg-transparent text-ink/70 hover:border-ink hover:text-ink'
      )}
    >
      Used
    </button>
  )
}

// ---------------------------------------------------------------------------
// Identity panel
// ---------------------------------------------------------------------------

type PilotIdentityPanelProps = {
  pilot: Pilot
  /** Persist a used-flag change; omit on read-only sheets (static stamps). */
  onToggleUsed?: (key: UsedToggleKey, next: boolean) => void
  /** Partial merge on this pilot; omit on read-only sheets (no Edit button). */
  patch?: SheetPatch
  className?: string
}

export function PilotIdentityPanel({
  pilot,
  onToggleUsed,
  patch,
  className,
}: PilotIdentityPanelProps) {
  // Per-section edit flag — flips ONLY this panel's fields to inline-edit.
  const [editing, setEditing] = useState(false)
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
    <section aria-label="Pilot identity" className={cn('min-w-0', className)}>
      {/* Section header — owns the panel's OWN Edit button (no global mode). */}
      <div className="mb-2 flex min-h-7 items-center justify-between gap-2">
        <span className="bg-ink px-2 pb-px pt-[2px] font-cond text-xs font-bold uppercase leading-relaxed tracking-caps text-su-white">
          Identity
        </span>
        {canEdit && (
          <SectionEditButton
            section="Identity"
            editing={isEditing}
            onToggle={() => setEditing((v) => !v)}
          />
        )}
      </div>

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
    </section>
  )
}
