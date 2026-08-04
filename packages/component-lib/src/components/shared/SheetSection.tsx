/**
 * SheetSection — the UNIFIED EDIT LANGUAGE primitives shared by all three
 * live sheets (redesign plan: three interaction archetypes, one editing cue,
 * one shared picker modal).
 *
 *   (A) FIELD sections: `SectionEditButton` — a per-section Edit/Done toggle
 *       that flips ONLY its own section's fields into inline-edit
 *       (InlineEditField, single-line or `multiline`). No global edit mode.
 *   (B) COLLECTION sections: `SectionAddButton` — an always-visible,
 *       always-ENABLED '+ Add' opening the ONE shared picker modal
 *       (`SheetPickerModal` over ModalShell); `CardRemoveButton` is the
 *       per-card remove (✕) control.
 *   (C) STAT cells stay always-live StatBlock pips — no primitive needed here.
 *
 * `EDIT_CUE_HOVER_CLASS` is the single editing cue: a dashed outline on
 * section-edit fields and per-card controls (StatBlocks carry no cue).
 */

import type { ComponentPropsWithoutRef, ReactElement, ReactNode } from 'react'
import { cloneElement, isValidElement } from 'react'
import { cn } from '../../utils/cn'
import { Button } from '../chrome/Button'
import { Glyph } from '../chrome/glyphs'
import { FOCUS_RING } from '../chrome/interaction'
import { ModalShell } from './ModalShell'

// ---------------------------------------------------------------------------
// HButton — the container-header control button (design `.hbtn`, clean-edit.html
// :384-411). 2px border, radius 3, paper fill, 10.5px cond bold caps; the
// `edit` default hovers to an ink fill, `done` is a filled deep-tone chip, and
// `add` is a deep-tone outline with a circled-plus that fills on hover. The
// 44px coarse-pointer floor (min-h-11) collapses to the 32px design height at
// `sm`.
// ---------------------------------------------------------------------------

type HButtonVariant = 'edit' | 'done' | 'add'

const HBTN_BASE = `inline-flex cursor-pointer items-center gap-1.5 rounded-card border-2 px-3 font-cond text-label-lg font-bold uppercase leading-none tracking-caps-wide whitespace-nowrap transition-colors min-h-11 sm:min-h-8 ${FOCUS_RING} print:hidden`

const HBTN_VARIANT: Record<HButtonVariant, string> = {
  edit: 'border-ink bg-paper text-ink hover:bg-ink hover:text-paper',
  done: 'border-[color:var(--tone-deep,var(--color-rust))] bg-[color:var(--tone-deep,var(--color-rust))] text-paper hover:border-ink hover:bg-ink',
  add: 'border-[color:var(--tone-deep,var(--color-rust))] bg-paper text-[color:var(--tone-deep,var(--color-rust))] hover:bg-[color:var(--tone-deep,var(--color-rust))] hover:text-paper',
}

type HButtonProps = ComponentPropsWithoutRef<'button'> & {
  variant?: HButtonVariant
}

/** Container-header control button (design `.hbtn`). */
export function HButton({
  variant = 'edit',
  className,
  type = 'button',
  children,
  ...props
}: HButtonProps) {
  return (
    <button type={type} className={cn(HBTN_BASE, HBTN_VARIANT[variant], className)} {...props}>
      {children}
    </button>
  )
}

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
    <HButton
      variant={editing ? 'done' : 'edit'}
      aria-pressed={editing}
      aria-label={
        editing ? `Done editing ${section.toLowerCase()}` : `Edit ${section.toLowerCase()}`
      }
      onClick={onToggle}
      className={className}
    >
      {editing ? (
        <Glyph name="check" className="h-3.5 w-3.5" />
      ) : (
        <Glyph name="pencil" className="h-3.5 w-3.5" />
      )}
      {editing ? 'Done' : 'Edit'}
    </HButton>
  )
}

// ---------------------------------------------------------------------------
// (B) COLLECTION sections — always-available add / per-card remove
// ---------------------------------------------------------------------------

type SectionManageButtonProps = {
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
export function SectionManageButton({ label, onClick, className }: SectionManageButtonProps) {
  return (
    <HButton
      variant="add"
      aria-label={`Manage ${label.toLowerCase()}`}
      onClick={onClick}
      className={className}
    >
      <span className="flex h-4 w-4 items-center justify-center rounded-full border-2 border-current">
        <Glyph name="plus" className="h-2 w-2" />
      </span>
      Manage {label}
    </HButton>
  )
}

// ---------------------------------------------------------------------------
// Per-card controls (redesign G4) — the ✕ remove (+ optional ⇄ swap) cluster
// renders icon-only in the entity-card HEADER top-right via Card's card-level
// `controls` slot (never in the foot). The `cardRemoveControls` factory that
// builds that cluster, plus the shared editing cue it stamps onto the card,
// live in `./editLanguage` (a components-free module). `CardRemoveButton` below
// is the standalone button variant.
// ---------------------------------------------------------------------------

type CardRemoveButtonProps = {
  /** The card's entity name, for the accessible label. */
  name: string
  onRemove: () => void
  className?: string
}

/** Per-card remove (✕) control — always available; carries the editing cue. */
export function CardRemoveButton({ name, onRemove, className }: CardRemoveButtonProps) {
  return (
    <Button
      size="mini"
      variant="danger"
      aria-label={`Remove ${name}`}
      onClick={onRemove}
      className={cn('min-h-11 sm:min-h-6 print:hidden', className)}
    >
      &#10005; Remove
    </Button>
  )
}

// ---------------------------------------------------------------------------
// The ONE shared picker modal (collections + single-select pickers)
// ---------------------------------------------------------------------------

type SheetPickerModalProps = {
  open: boolean
  onClose: () => void
  title: string
  /** ModalShell max width; defaults to 80% of the viewport for the wide picker grid. */
  maxWidth?: string
  /** Confirm/cancel footer for single-select pickers (multi-select omits it). */
  footer?: ReactNode
  /**
   * The searcher-picker layout: render a BARE ModalShell and hand the single
   * `EntitySearcher` child its own frame by injecting this modal's
   * `title`/`onClose`. (The default framed layout stays for the master-detail
   * single-select pickers that pass a `footer`.)
   */
  floating?: boolean
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
  maxWidth = 'max-w-[80vw]',
  footer,
  floating = false,
  children,
}: SheetPickerModalProps) {
  // Floating searcher-picker: a BARE ModalShell; the child EntitySearcher owns
  // the whole frame (header + search + close + internal scroll + pinned rail).
  // Inject this modal's title/onClose onto that single child.
  if (floating) {
    const searcher = isValidElement(children)
      ? cloneElement(children as ReactElement<{ title?: string; onClose?: () => void }>, {
          title,
          onClose,
        })
      : children
    return (
      <ModalShell
        open={open}
        onOpenChange={(next) => {
          if (!next) onClose()
        }}
        title={title}
        maxWidth={maxWidth}
        bare
      >
        {searcher}
      </ModalShell>
    )
  }

  return (
    <ModalShell
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose()
      }}
      title={title}
      maxWidth={maxWidth}
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
