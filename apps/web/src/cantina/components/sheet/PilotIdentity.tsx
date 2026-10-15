/**
 * PilotIdentityPanel — the pilot poster's IDENTITY card body: the poster's
 * labeled fields — Name / Callsign / Class / Appearance
 * (left) and Motto / Keepsake / Background with their once-per-Downtime USED
 * toggles on the right, plus a folded-in Bio field (the Bio's home: the sheet
 * has no Bio section) — rendered via the
 * shared IdentityField primitive.
 *
 * FIELD-section archetype (unified edit language). The parent
 * `SheetSectionCard`'s header owns the section's Edit/Done button, so this
 * panel is CONTROLLED via the `editing` prop rather than owning its own toggle
 * state. Class is
 * picker-backed — its edit affordance opens the ONE shared picker modal
 * (changing class KEEPS abilities).
 *
 * Its body is `ClassPathPicker`, NOT the shared `EntitySearcher` that every
 * other reference-entity picker in this app routes through. This is the
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

import type { Pilot } from 'cantina-domain/schemas/pilot'
import type { CSSProperties } from 'react'
import { useState } from 'react'
import { Badge, Button, Field, tokens } from '../../../ui/index'
import { resolveClassName } from '../../lib/classRef'
import { classChangePatch } from '../../lib/rules/classPath'
import { ClassPathPicker } from '../pilot/ClassPathPicker'
import { selectableClasses } from '../wizard/classOptions.model'
import { SheetPickerModal } from './SheetSection'
import type { SheetPatch } from './sheetViewProps.model'

export type UsedToggleKey = 'background' | 'motto' | 'keepsake'

/** The used pip: a hollow chip in the stamp's current colour. */
const PIP = {
  border: `${tokens.borderWidth.pill} solid currentColor`,
  borderRadius: tokens.radius.badge,
  flexShrink: 0,
  height: '12px',
  width: '16px',
} satisfies CSSProperties

/** Set: the pip fills with the sheet's tone. */
const PIP_SET = {
  backgroundColor: 'var(--tone, var(--color-pilot))',
  borderColor: 'var(--tone, var(--color-pilot))',
} satisfies CSSProperties

const USED_CHIP = { gap: tokens.space[6] } satisfies CSSProperties

const PANEL = {
  display: 'flex',
  flexDirection: 'column',
  gap: tokens.space[12],
  height: '100%',
  minWidth: 0,
} satisfies CSSProperties

/** A field grid; its two-column split from `sm` is `.su-sheet-pilot-split`. */
const FIELD_GRID = {
  columnGap: tokens.space[16],
  display: 'grid',
  rowGap: tokens.space[12],
} satisfies CSSProperties

const ONE_COLUMN = { gridTemplateColumns: 'repeat(1, minmax(0, 1fr))' } satisfies CSSProperties

const FIELD_COLUMN = {
  display: 'flex',
  flexDirection: 'column',
  gap: tokens.space[12],
  minWidth: 0,
} satisfies CSSProperties

const BIO = {
  display: 'flex',
  flex: '1 1 0%',
  flexDirection: 'column',
  minHeight: 0,
} satisfies CSSProperties

const PICKER_ACTIONS = {
  display: 'flex',
  gap: tokens.space[8],
  justifyContent: 'flex-end',
  paddingTop: tokens.space[16],
} satisfies CSSProperties

// ---------------------------------------------------------------------------
// Used chip (once-per-Downtime toggles) — live-play control,
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
  const pip = <span aria-hidden="true" style={{ ...PIP, ...(used && PIP_SET) }} />
  if (!onToggle) {
    // Read-only: the stamp shows only when set (nothing to toggle, so an unset
    // one would be a control that isn't).
    if (!used) return null
    return (
      <Badge shape="chip" style={USED_CHIP}>
        {pip}
        Used
      </Badge>
    )
  }
  // Interactive: `aria-pressed` carries the state for assistive tech, since the
  // surface does not show it visually.
  return (
    <Badge
      as="button"
      shape="chip"
      aria-pressed={used}
      aria-label={used ? `Reset ${label} used` : `Mark ${label} used`}
      onClick={() => onToggle(!used)}
      style={USED_CHIP}
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
   * Edit/Done button (the chead row lives in the card, not here).
   */
  /** Persist a used-flag change; omit on read-only sheets (static stamps). */
  onToggleUsed?: (key: UsedToggleKey, next: boolean) => void
  /** Partial merge on this pilot; omit on read-only sheets (no edit affordance). */
  patch?: SheetPatch
}

export function PilotIdentityPanel({ pilot, onToggleUsed, patch }: PilotIdentityPanelProps) {
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
  // The band's title is the name; a callsign that only repeats it adds nothing
  // in Read. Edit always shows it: it is the callsign's edit surface.
  const showCallsign =
    canEdit || pilot.callsign.trim().toLowerCase() !== pilot.name.trim().toLowerCase()
  // In Read a Field with no value renders nothing, so the left column can be
  // empty (a Starter pilot: callsign is the name, no pronouns). Drop it then,
  // rather than leave half the card blank beside the Motto column.
  const leftColumn = canEdit || showCallsign || (pilot.pronouns ?? '').trim() !== ''

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
    // Full height + a flex column: the identity card is stretched to match the
    // vitals card beside it, so the panel spends that height on its fields
    // (the Bio grows into whatever is left) instead of leaving dead paper.
    <div style={PANEL}>
      {/* Poster field grid — left / right columns; single column on mobile in
          the poster's reading order. The columns keep their natural row rhythm
          — spreading them independently pulled Keepsake/Background out of line
          with Callsign/Class, since each column distributes its own slack. All
          the leftover height goes to the Bio instead. */}
      <div
        className={leftColumn ? 'su-sheet-pilot-split' : undefined}
        style={leftColumn ? FIELD_GRID : { ...FIELD_GRID, ...ONE_COLUMN }}
      >
        {leftColumn && (
          <div style={FIELD_COLUMN}>
            {/* Callsign and Class lead TOGETHER, at the same prominence: what a
              pilot is called and what they do are the two facts you identify
              them by. Name lives here too, in Edit: this is the pilot's name edit
              surface (the band's title mirrors it).

              Read prints only what the band does not: its eyebrow stamps the
              class and its title is the name, so Class goes, and Callsign goes
              when it is the name. Repeating them straight under the band read
              as a subtitle saying the title twice. */}
            {(canEdit || showCallsign) && (
              <div className="su-sheet-pilot-split" style={FIELD_GRID}>
                {showCallsign && (
                  <Field
                    label="Callsign"
                    value={pilot.callsign}
                    onSave={canEdit ? saveRequired('callsign') : undefined}
                    prominent
                  />
                )}
                {canEdit && (
                  <Field
                    label="Class"
                    value={resolveClassName(pilot.classRef)}
                    onEditClick={openClassPicker}
                    prominent
                  />
                )}
              </div>
            )}
            {/* Read omits the name: it is the band's title. */}
            {canEdit && <Field label="Name" value={pilot.name} onSave={saveRequired('name')} />}
            <Field
              label="Pronouns"
              value={pilot.pronouns ?? ''}
              onSave={canEdit ? saveText('pronouns') : undefined}
              placeholder="—"
            />
          </div>
        )}
        <div style={FIELD_COLUMN}>
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

      {/* Bio — the freeform backstory, a full-width identity field. */}
      <div style={BIO}>
        <Field
          label="Bio"
          value={pilot.description ?? ''}
          multiline
          fill
          onSave={canEdit ? saveText('description') : undefined}
          placeholder="No bio written yet."
          className="su-sheet-pilot-fill"
        />
      </div>

      {/* Class — single-select through the ONE shared picker, same as every
          other "choose a reference entity" modal. */}
      {/* NOT `floating`. That branch renders a bare shell and hands the frame
          to a single `EntitySearcher` child; this body is a ClassPathPicker, so
          it wants the modal's own frame. And since `SheetPickerModal` has no
          `footer` prop by design (a `floating` + `footer` call would silently
          drop its confirm buttons), the actions render here,
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
        <div style={PICKER_ACTIONS}>
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
