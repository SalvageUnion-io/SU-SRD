/**
 * IdentityField — the poster's labeled identity field (redesign shared shell,
 * Task A.2). A small uppercase black label tab sits TIGHT (~2px) above the
 * value box. Renders a READ-ONLY display value by default and becomes an
 * inline click-to-edit input ONLY when its owning SECTION is flipped into edit
 * via that section's own Edit button — never a global flag, never always-open
 * inputs.
 *
 * The label + value box + pen + click-to-edit behaviour is the shared
 * `InlineEditField` atom (component-lib): the freetext path delegates to it,
 * mapping the section `editing` flag onto the atom's `readOnly`. The one thing
 * the atom can't express — a picker-backed field (e.g. Class → opens the shared
 * picker modal) — keeps its bespoke button branch here.
 *
 * Used for Callsign / Class / Name / Motto / Keepsake / Background /
 * Appearance on the pilot sheet, and Pattern / Chassis / Quirk etc. on the
 * mech & crawler sheets (phases 2–3).
 */

import type { ReactNode } from 'react'
import { InlineEditField } from 'component-lib'

import { cn } from '../../lib/utils'
import { EDIT_CUE_CLASS } from 'component-lib'

type IdentityFieldProps = {
  /** Small uppercase label, e.g. 'Callsign'. */
  label: string
  /** Current stored value (shown read-only unless the section is editing). */
  value: string
  /**
   * Section-level edit flag (from the section's own Edit button). Only when
   * true AND an onSave/onEditClick is wired does the field become editable.
   */
  editing?: boolean
  /** Persist a new value; enables inline editing while the section edits. */
  onSave?: (next: string) => Promise<void> | void
  /**
   * Alternative edit affordance for non-freetext fields (e.g. Class → opens
   * the shared picker modal). Mutually exclusive with onSave.
   */
  onEditClick?: () => void
  /** Multi-line value (a 3-row textarea instead of a single-line input). */
  multiline?: boolean
  /** Read-only placeholder when the value is empty. */
  placeholder?: string
  /** Trailing control beside the label (e.g. a once-per-downtime USED toggle). */
  labelAction?: ReactNode
  ariaLabel?: string
  className?: string
}

/**
 * Editing state (`.ifield`): solid 2px tone-deep border, room on the right for
 * the pinned pen icon. Only the picker branch needs it now — the freetext path
 * gets the same look from the shared atom.
 */
const EDIT_VALUE_BOX_CLASS =
  'relative flex min-h-[44px] items-center rounded-card border-2 border-[color:var(--tone-deep,var(--color-ink))] bg-paper px-3 py-2 pr-9 font-body text-sm text-ink'

/** Pen icon pinned right inside an editing `.ifield` box (design-spec `.ifield .pen`). */
function PenIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="pointer-events-none absolute right-[10px] top-1/2 h-[15px] w-[15px] -translate-y-1/2 text-ink/55"
      aria-hidden="true"
    >
      <path d="m16.5 3.5 4 4L7 21H3v-4z" />
    </svg>
  )
}

export function IdentityField({
  label,
  value,
  editing = false,
  onSave,
  onEditClick,
  multiline = false,
  placeholder = '—',
  labelAction,
  ariaLabel,
  className,
}: IdentityFieldProps) {
  const fieldLabel = ariaLabel ?? label

  // Picker-backed field (e.g. Class): the box is a button opening the shared
  // picker modal — the one shape the freetext atom can't express.
  if (editing && onEditClick) {
    return (
      <div className={cn('flex min-w-0 flex-col', className)}>
        <span className="mb-[2px] flex items-center justify-between gap-2">
          <span className="bg-ink px-1.5 pb-px pt-[2px] font-cond text-label font-bold uppercase leading-none tracking-caps text-paper">
            {label}
          </span>
          {labelAction}
        </span>
        <button
          type="button"
          aria-label={`Change ${fieldLabel.toLowerCase()}`}
          onClick={onEditClick}
          className={cn(
            EDIT_VALUE_BOX_CLASS,
            EDIT_CUE_CLASS,
            'w-full cursor-pointer text-left hover:bg-wk-bg-2'
          )}
        >
          <span className="min-w-0 flex-1 truncate">{value || placeholder}</span>
          <PenIcon />
        </button>
      </div>
    )
  }

  // Freetext path (read-only or section-editable) — the shared atom. The section
  // `editing` flag maps onto the atom's `readOnly`: read-only until the section
  // is in edit AND an onSave is wired.
  return (
    <InlineEditField
      label={label}
      value={value}
      readOnly={!editing || onSave === undefined}
      onSave={onSave ? (next) => onSave(String(next)) : () => {}}
      multiline={multiline}
      placeholder={placeholder}
      labelAction={labelAction}
      ariaLabel={`Edit ${fieldLabel.toLowerCase()}`}
      className={className}
    />
  )
}
