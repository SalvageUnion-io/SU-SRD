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
 * picker-backed — its edit affordance opens the ONE shared picker modal
 * (changing class KEEPS abilities, matching the old edit-mode semantics).
 *
 * Its body is `ClassPathPicker`, NOT the shared `EntitySearcher` that every
 * other reference-entity picker in this app routes through (#713). This is the
 * deliberate exception: a class change is a move around the advancement ring,
 * so the options are grouped by where this pilot can actually go and a hybrid
 * destination may have to ASK which Core class they came from before it can
 * seal the right two trees. `EntitySearcher` filters and facets a flat pool —
 * it has no way to express "reachable from here", "this is the gate tree", or
 * "answer this question first", and those are the whole feature.
 *
 * readOnly (no onToggleUsed / no patch): used chips render as static 'USED'
 * stamps only when set, and `editing` has no effect (no patch means no edit
 * affordance renders regardless).
 */

import { Badge, Button, Field, SheetPickerModal, selectableClasses } from 'component-lib'
import { useState } from 'react'
import { resolveClassName } from '../../lib/classRef'
import type { Pilot } from '../../lib/schemas/pilot'
import { cn } from '../../lib/utils'
import { ClassPathPicker } from '../pilot/ClassPathPicker'
import { classChangePatch } from '../pilot/classPathOptions'
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
  // The stamp itself never changes: black at every state, so the row's shape is
  // stable and the eye isn't asked to re-read the label to learn the state.
  // ONLY the pip carries it — a small CHIP (the stamp's own rectangular
  // vocabulary), hollow when unset and tone-filled when set.
  const pip = (
    <span
      aria-hidden="true"
      className={cn(
        'h-3 w-4 shrink-0 rounded-badge border-2 border-current',
        used && 'border-[color:var(--tone,var(--color-pilot))] bg-[var(--tone,var(--color-pilot))]'
      )}
    />
  )
  if (!onToggle) {
    // Read-only: the stamp shows only when set (nothing to toggle, so an unset
    // one would be a control that isn't).
    if (!used) return null
    return (
      <Badge shape="chip" surface="solid" className="gap-1.5">
        {pip}
        Used
      </Badge>
    )
  }
  // Interactive: `aria-pressed` carries the state for assistive tech, since the
  // surface no longer does it visually.
  return (
    <Badge
      as="button"
      shape="chip"
      surface="solid"
      aria-pressed={used}
      aria-label={used ? `Reset ${label} used` : `Mark ${label} used`}
      onClick={() => onToggle(!used)}
      className="gap-1.5"
    >
      {pip}
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
  /** Persist a used-flag change; omit on read-only sheets (static stamps). */
  onToggleUsed?: (key: UsedToggleKey, next: boolean) => void
  /** Partial merge on this pilot; omit on read-only sheets (no edit affordance). */
  patch?: SheetPatch
  className?: string
}

export function PilotIdentityPanel({
  pilot,
  onToggleUsed,
  patch,
  className,
}: PilotIdentityPanelProps) {
  const [classPickerOpen, setClassPickerOpen] = useState(false)
  // Class picker holds a pending selection until confirmed (destructive-ish:
  // it re-homes the pilot's class; abilities are intentionally kept).
  const [pendingClass, setPendingClass] = useState<string>(pilot.classRef)
  // Only set when the destination is a hybrid this pilot cannot reach, so the
  // origin cannot be derived and the player has to name it.
  const [answeredOrigin, setAnsweredOrigin] = useState<string | undefined>(undefined)

  // Resolved lazily — only once the picker opens — so read-only/snapshot
  // renders never touch the (possibly unloaded) reference class catalog.
  const { base, specialisations } = classPickerOpen
    ? selectableClasses(undefined, true)
    : { base: [], specialisations: [] }
  const allClasses = [...base, ...specialisations]

  const canEdit = patch !== undefined

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
    setAnsweredOrigin(undefined)
    setClassPickerOpen(true)
  }

  function confirmClass() {
    if (pendingClass && pendingClass !== pilot.classRef) {
      // ONE patch. `patchPilot` routes any patch containing `classRef` through
      // the soft-warning confirm, so writing the origin separately would either
      // slip past that gate or leave a pilot whose class moved and whose origin
      // did not — the unknown-origin state the field exists to prevent.
      patch?.(classChangePatch(allClasses, pendingClass, answeredOrigin))
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
    // `h-full` + a flex column: the identity card is stretched to match the
    // vitals card beside it, so the panel spends that height on its fields
    // (the Bio grows into whatever is left) instead of leaving dead paper.
    <div className={cn('flex h-full min-w-0 flex-col gap-3', className)}>
      {/* Poster field grid — left / right columns; single column on mobile in
          the poster's reading order. The columns keep their natural row rhythm
          — spreading them independently pulled Keepsake/Background out of line
          with Callsign/Class, since each column distributes its own slack. All
          the leftover height goes to the Bio instead. */}
      <div className="grid grid-cols-1 gap-x-4 gap-y-3 sm:grid-cols-2">
        <div className="flex min-w-0 flex-col gap-3">
          {/* Callsign and Class lead TOGETHER, at the same prominence: what a
              pilot is called and what they do are the two facts you identify
              them by. Name lives here too — with the global Edit toggle gone,
              this is the pilot's name edit surface (the hero title mirrors it). */}
          <div className="grid grid-cols-1 gap-x-4 gap-y-3 sm:grid-cols-2">
            <Field
              label="Callsign"
              value={pilot.callsign}
              onSave={canEdit ? saveRequired('callsign') : undefined}
              prominent
            />
            <Field
              label="Class"
              value={resolveClassName(pilot.classRef)}
              onEditClick={canEdit ? openClassPicker : undefined}
              prominent
            />
          </div>
          <Field
            label="Name"
            value={pilot.name}
            onSave={canEdit ? saveRequired('name') : undefined}
          />
          <Field
            label="Pronouns"
            value={pilot.pronouns ?? ''}
            onSave={canEdit ? saveText('pronouns') : undefined}
            placeholder="—"
          />
        </div>
        <div className="flex min-w-0 flex-col gap-3">
          <Field
            label="Motto"
            value={pilot.motto}
            multiline
            onSave={canEdit ? saveText('motto') : undefined}
            labelAction={usedChip('motto', 'motto')}
          />
          <Field
            label="Keepsake"
            value={pilot.keepsake}
            multiline
            onSave={canEdit ? saveText('keepsake') : undefined}
            labelAction={usedChip('keepsake', 'keepsake')}
          />
          <Field
            label="Background"
            value={pilot.background}
            multiline
            onSave={canEdit ? saveText('background') : undefined}
            labelAction={usedChip('background', 'background')}
          />
        </div>
      </div>

      {/* Appearance spans the card: it is prose, and a half-width column
          wrapped it into a narrow ribbon beside the single-line fields. */}
      <Field
        label="Appearance"
        value={pilot.appearance}
        multiline
        onSave={canEdit ? saveText('appearance') : undefined}
      />

      {/* Bio — folded in from the dropped live-play Bio section (#409): the
          freeform backstory previously rendered via SheetDescription now
          lives as an extra full-width identity field. */}
      <div className="flex min-h-0 flex-1 flex-col">
        <Field
          label="Bio"
          value={pilot.description ?? ''}
          multiline
          fill
          onSave={canEdit ? saveText('description') : undefined}
          placeholder="No bio written yet."
          className="flex-1"
        />
      </div>

      {/* Class — single-select through the ONE shared picker, same as every
          other "choose a reference entity" modal. */}
      {/* NOT `floating`. That branch renders a bare shell and hands the frame
          to a single `EntitySearcher` child; this body is a ClassPathPicker, so
          it wants the modal's own frame. And since `SheetPickerModal` has no
          `footer` prop by design (#713 removed it — a `floating` + `footer`
          call silently dropped its confirm buttons), the actions render here,
          as the picker's siblings. */}
      <SheetPickerModal
        open={classPickerOpen}
        onClose={() => setClassPickerOpen(false)}
        title="Change Class"
      >
        <ClassPathPicker
          allClasses={allClasses}
          currentClassRef={pilot.classRef}
          pendingClassRef={pendingClass}
          onSelect={setPendingClass}
          answeredOrigin={answeredOrigin}
          onAnswerOrigin={setAnsweredOrigin}
        />
        <div className="flex justify-end gap-2 pt-4">
          <Button variant="ghost" size="compact" onClick={() => setClassPickerOpen(false)}>
            Cancel
          </Button>
          <Button
            variant="primary"
            size="compact"
            disabled={!pendingClass || pendingClass === pilot.classRef}
            onClick={confirmClass}
          >
            Change Class
          </Button>
        </div>
      </SheetPickerModal>
    </div>
  )
}
