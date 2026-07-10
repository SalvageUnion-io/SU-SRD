/**
 * IdentityField — the poster's labeled identity field (redesign shared shell,
 * Task A.2). A small uppercase black label tab sits TIGHT (~2px) above the
 * value box. Renders a READ-ONLY display value by default and becomes an
 * inline click-to-edit input (InlineEditField / InlineEditTextArea) ONLY when
 * its owning SECTION is flipped into edit via that section's own Edit button
 * — never a global flag, never always-open inputs.
 *
 * Used for Callsign / Class / Name / Motto / Keepsake / Background /
 * Appearance on the pilot sheet, and Pattern / Chassis / Quirk etc. on the
 * mech & crawler sheets (phases 2–3).
 */

import type { ReactNode } from 'react'

import { cn } from '../../lib/utils'
import { EDIT_CUE_CLASS } from './SheetSection'
import { InlineEditField } from './InlineEditField'
import { InlineEditTextArea } from './InlineEditTextArea'

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
  /** Multi-line value (InlineEditTextArea instead of InlineEditField). */
  multiline?: boolean
  /** Read-only placeholder when the value is empty. */
  placeholder?: string
  /** Trailing control beside the label (e.g. a once-per-downtime USED toggle). */
  labelAction?: ReactNode
  ariaLabel?: string
  className?: string
}

const VALUE_BOX_CLASS =
  'flex min-h-[38px] items-center rounded-[6px] border-[1.5px] bg-paper px-3 py-1.5 font-body text-sm text-ink'

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
  const isEditable = editing && (onSave !== undefined || onEditClick !== undefined)

  let valueNode: ReactNode
  if (isEditable && onEditClick) {
    // Picker-backed field (e.g. Class): the box becomes a button opening the
    // shared picker modal.
    valueNode = (
      <button
        type="button"
        aria-label={`Change ${fieldLabel.toLowerCase()}`}
        onClick={onEditClick}
        className={cn(
          VALUE_BOX_CLASS,
          EDIT_CUE_CLASS,
          'w-full cursor-pointer justify-between gap-2 border-ink text-left hover:bg-wk-bg-2'
        )}
      >
        <span className="min-w-0 flex-1 truncate">{value || placeholder}</span>
        <span aria-hidden="true" className="shrink-0 font-cond text-label uppercase text-wk-muted">
          Change
        </span>
      </button>
    )
  } else if (isEditable && onSave) {
    valueNode = (
      <span className={cn(VALUE_BOX_CLASS, EDIT_CUE_CLASS, 'border-ink')}>
        {multiline ? (
          <span className="w-full min-w-0">
            <InlineEditTextArea
              value={value}
              ariaLabel={`Edit ${fieldLabel.toLowerCase()}`}
              placeholder={placeholder}
              onSave={onSave}
            />
          </span>
        ) : (
          <InlineEditField
            value={value}
            ariaLabel={`Edit ${fieldLabel.toLowerCase()}`}
            inputClassName="w-full text-left font-body text-sm font-normal"
            className="min-h-0 w-full justify-start font-body text-sm font-normal sm:min-h-0"
            onSave={(next) => onSave(String(next))}
          />
        )}
      </span>
    )
  } else {
    valueNode = (
      <span
        className={cn(VALUE_BOX_CLASS, !value && 'text-wk-muted')}
        style={{
          borderColor: 'color-mix(in oklch, var(--tone-deep, var(--color-ink)) 50%, transparent)',
        }}
      >
        <span className={cn('min-w-0', multiline ? 'whitespace-pre-wrap' : 'truncate')}>
          {value || placeholder}
        </span>
      </span>
    )
  }

  return (
    <div className={cn('flex min-w-0 flex-col', className)}>
      {/* Label row — tight (~2px) above the value box (redesign refinement). */}
      <span className="mb-[2px] flex items-center justify-between gap-2">
        <span className="bg-ink px-1.5 pb-px pt-[2px] font-cond text-label font-bold uppercase leading-none tracking-caps text-su-white">
          {label}
        </span>
        {labelAction}
      </span>
      {valueNode}
    </div>
  )
}
