/**
 * SheetSection — the UNIFIED EDIT LANGUAGE primitives shared by all three
 * live sheets (redesign plan: three interaction archetypes, one editing cue,
 * one shared picker modal).
 *
 *   (A) FIELD sections: `SectionEditButton` — a per-section Edit/Done toggle
 *       that flips ONLY its own section's fields into inline-edit
 *       (InlineEditField / InlineEditTextArea). No global edit mode.
 *   (B) COLLECTION sections: `SectionAddButton` — an always-visible,
 *       always-ENABLED '+ Add' opening the ONE shared picker modal
 *       (`SheetPickerModal` over ModalShell); `CardRemoveButton` is the
 *       per-card remove (✕) control.
 *   (C) STAT cells stay always-live StatBlock pips — no primitive needed here.
 *
 * `EDIT_CUE_CLASS` is the single editing cue: a consistent dashed outline on
 * section-edit fields and per-card controls (StatBlocks carry no cue).
 */

import type { ReactNode } from 'react'
import { MiniBtn, ModalShell } from 'suref-react'

import { cn } from '../../lib/utils'

/**
 * The ONE editing cue (redesign rule): dashed outline in the sheet's deep
 * tone on anything that is currently editable via a section Edit or a
 * per-card control.
 */
// biome-ignore lint/style/useComponentExportOnlyModules: the shared editing-cue class constant belongs beside the section components that define the edit language
export const EDIT_CUE_CLASS =
  'outline-dashed outline-2 outline-offset-2 outline-[color:var(--tone-deep,var(--color-rust))]'

// ---------------------------------------------------------------------------
// (A) FIELD sections — per-section Edit toggle
// ---------------------------------------------------------------------------

type SectionEditButtonProps = {
  /** Section name for the accessible label, e.g. 'Identity'. */
  section: string
  editing: boolean
  onToggle: () => void
  className?: string
}

/** Per-section Edit/Done toggle — flips ONLY its own section into inline-edit. */
export function SectionEditButton({
  section,
  editing,
  onToggle,
  className,
}: SectionEditButtonProps) {
  return (
    <MiniBtn
      aria-pressed={editing}
      aria-label={
        editing ? `Done editing ${section.toLowerCase()}` : `Edit ${section.toLowerCase()}`
      }
      onClick={onToggle}
      className={cn(
        'min-h-11 sm:min-h-7 print:hidden',
        editing && 'bg-ink text-su-white',
        className
      )}
    >
      {editing ? 'Done' : 'Edit'}
    </MiniBtn>
  )
}

// ---------------------------------------------------------------------------
// (B) COLLECTION sections — always-available add / per-card remove
// ---------------------------------------------------------------------------

type SectionAddButtonProps = {
  /** What gets added, for the accessible label, e.g. 'ability'. */
  label: string
  onClick: () => void
  className?: string
}

/**
 * Always-visible, always-ENABLED '+ Add' for a collection section header.
 * // TODO(redesign): rule-gate add/remove (TP / maxAbilities / slots / scrap
 * economy) — deferred; users self-manage for now.
 */
export function SectionAddButton({ label, onClick, className }: SectionAddButtonProps) {
  return (
    <MiniBtn
      aria-label={`Add ${label.toLowerCase()}`}
      onClick={onClick}
      className={cn('min-h-11 sm:min-h-7 print:hidden', className)}
    >
      + Add
    </MiniBtn>
  )
}

type CardRemoveButtonProps = {
  /** The card's entity name, for the accessible label. */
  name: string
  onRemove: () => void
  className?: string
}

/** Per-card remove (✕) control — always available; carries the editing cue. */
export function CardRemoveButton({ name, onRemove, className }: CardRemoveButtonProps) {
  return (
    <MiniBtn
      aria-label={`Remove ${name}`}
      onClick={onRemove}
      className={cn(EDIT_CUE_CLASS, 'min-h-11 sm:min-h-6 print:hidden', className)}
    >
      &#10005; Remove
    </MiniBtn>
  )
}

// ---------------------------------------------------------------------------
// The ONE shared picker modal (collections + single-select pickers)
// ---------------------------------------------------------------------------

type SheetPickerModalProps = {
  open: boolean
  onClose: () => void
  title: string
  /** ModalShell max width; defaults to the wide picker-grid width. */
  maxWidth?: string
  /** Confirm/cancel footer for single-select pickers (multi-select omits it). */
  footer?: ReactNode
  children: ReactNode
}

/**
 * The single shared picker modal every collection '+ Add' (and single-select
 * swap) opens — never hand-roll per-sheet dialogs. Multi-select pickers write
 * through on toggle (ITUN auto-saves; there is no Save button); single-select
 * pickers pass a confirm `footer`.
 */
export function SheetPickerModal({
  open,
  onClose,
  title,
  maxWidth = 'max-w-3xl',
  footer,
  children,
}: SheetPickerModalProps) {
  return (
    <ModalShell
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose()
      }}
      title={title}
      headerBg="bg-su-orange"
      maxWidth={maxWidth}
      align="center"
    >
      <div className="bg-paper p-5">{children}</div>
      {footer && (
        <div className="flex justify-end gap-2 border-t-2 border-ink bg-paper px-5 py-3">
          {footer}
        </div>
      )}
    </ModalShell>
  )
}
