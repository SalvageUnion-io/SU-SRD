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

import {
  type ComponentPropsWithoutRef,
  type ReactElement,
  type ReactNode,
  cloneElement,
  isValidElement,
} from 'react'
import { Button, ModalShell } from 'component-lib'
import type { ReferenceEntityControl } from 'component-lib'

import { cn } from '../../lib/utils'

/**
 * The ONE editing cue (redesign rule): dashed outline in the sheet's deep
 * tone on anything that is currently editable via a section Edit or a
 * per-card control.
 */
// biome-ignore lint/style/useComponentExportOnlyModules: the shared editing-cue class constant belongs beside the section components that define the edit language
export const EDIT_CUE_CLASS =
  'outline-dashed outline-2 outline-offset-2 outline-[color:var(--tone-deep,var(--color-rust))]'

/**
 * DisplayCard `cardStyle` override that stamps the editing cue onto a removable
 * entity card (redesign G4: the cue moves from the per-card control BUTTON onto
 * the CARD). Includes `shadow-lg` because DisplayCard's `cardStyle.className`
 * REPLACES the default shadow.
 */
// biome-ignore lint/style/useComponentExportOnlyModules: the removable-card style pairs with EDIT_CUE_CLASS as part of the shared edit-language vocabulary
export const REMOVABLE_CARD_STYLE: { className: string } = {
  className: cn('shadow-lg', EDIT_CUE_CLASS),
}

// ---------------------------------------------------------------------------
// Icons — inline strokes matching clean-edit.html's control glyphs. Each takes
// a className so it can size to its host button (design `.hbtn svg` / `.ctl svg`).
// ---------------------------------------------------------------------------

function PencilIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="m16.5 3.5 4 4L7 21H3v-4z" />
    </svg>
  )
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.4}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="m5.5 12.5 4 4 9-10" />
    </svg>
  )
}

function PlusIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={3}
      strokeLinecap="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M12 5v14M5 12h14" />
    </svg>
  )
}

function RemoveIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.2}
      strokeLinecap="round"
      className={className}
      aria-hidden="true"
    >
      <path d="m6 6 12 12M18 6 6 18" />
    </svg>
  )
}

function SwapIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M4 8h14M14.5 4.5 18 8l-3.5 3.5M20 16H6M9.5 12.5 6 16l3.5 3.5" />
    </svg>
  )
}

// ---------------------------------------------------------------------------
// HBtn — the container-header control button (design `.hbtn`, clean-edit.html
// :384-411). 2px border, radius 3, paper fill, 10.5px cond bold caps; the
// `edit` default hovers to an ink fill, `done` is a filled deep-tone chip, and
// `add` is a deep-tone outline with a circled-plus that fills on hover. The
// 44px coarse-pointer floor (min-h-11) collapses to the 32px design height at
// `sm`.
// ---------------------------------------------------------------------------

type HBtnVariant = 'edit' | 'done' | 'add'

const HBTN_BASE =
  'inline-flex cursor-pointer items-center gap-1.5 rounded-[3px] border-2 px-3 font-cond text-label-lg font-bold uppercase leading-none tracking-caps-wide whitespace-nowrap transition-colors min-h-11 sm:min-h-8 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-rust/25 print:hidden'

const HBTN_VARIANT: Record<HBtnVariant, string> = {
  edit: 'border-ink bg-paper text-ink hover:bg-ink hover:text-paper',
  done: 'border-[color:var(--tone-deep,var(--color-rust))] bg-[color:var(--tone-deep,var(--color-rust))] text-paper hover:border-ink hover:bg-ink',
  add: 'border-[color:var(--tone-deep,var(--color-rust))] bg-paper text-[color:var(--tone-deep,var(--color-rust))] hover:bg-[color:var(--tone-deep,var(--color-rust))] hover:text-paper',
}

type HBtnProps = ComponentPropsWithoutRef<'button'> & {
  variant?: HBtnVariant
}

/** Container-header control button (design `.hbtn`). */
export function HBtn({
  variant = 'edit',
  className,
  type = 'button',
  children,
  ...props
}: HBtnProps) {
  return (
    <button type={type} className={cn(HBTN_BASE, HBTN_VARIANT[variant], className)} {...props}>
      {children}
    </button>
  )
}

// ---------------------------------------------------------------------------
// Section header (`chead`) — shared by field + collection sections
// ---------------------------------------------------------------------------

type SectionCheadProps = {
  /** Section title, rendered as the ink stamp in the left group. */
  title: string
  /** Optional count/meta tag rendered after the title in the left group. */
  count?: ReactNode
  /** Right-group controls (the section's HBtn), pinned `ml-auto`. */
  actions?: ReactNode
  className?: string
}

/**
 * Section header row in the `chead` shape (clean-edit.html :330-332): a left
 * group (ink stamp title + optional count tag) and a right group pinned
 * `ml-auto` holding the section's HBtn. Phase 2 lifts this row verbatim into
 * SheetSectionCard's header, so field sections adopt it now.
 *
 * Also matches the poster's bare `.sect` region divider (clean-pilot.html
 * :215-218 — Inventory / Linked Units headers with no card frame): a SOLID
 * ink-35 rule fills the remaining width after the stamp/count, ahead of any
 * right-group actions.
 */
export function SectionChead({ title, count, actions, className }: SectionCheadProps) {
  return (
    <div className={cn('mb-2 flex min-h-8 flex-wrap items-center gap-x-2.5 gap-y-2', className)}>
      <div className="flex min-w-0 items-center gap-2">
        <span className="bg-ink px-2 pb-px pt-[2px] font-cond text-sm font-bold uppercase leading-relaxed tracking-caps text-paper">
          {title}
        </span>
        {count}
      </div>
      <span aria-hidden="true" className="h-0 min-w-3 flex-1 border-t-chrome border-ink/35" />
      {actions && <div className="ml-auto flex items-center gap-2">{actions}</div>}
    </div>
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
    <HBtn
      variant={editing ? 'done' : 'edit'}
      aria-pressed={editing}
      aria-label={
        editing ? `Done editing ${section.toLowerCase()}` : `Edit ${section.toLowerCase()}`
      }
      onClick={onToggle}
      className={className}
    >
      {editing ? <CheckIcon className="h-3.5 w-3.5" /> : <PencilIcon className="h-3.5 w-3.5" />}
      {editing ? 'Done' : 'Edit'}
    </HBtn>
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
    <HBtn
      variant="add"
      aria-label={`Add ${label.toLowerCase()}`}
      onClick={onClick}
      className={className}
    >
      <span className="flex h-4 w-4 items-center justify-center rounded-full border-2 border-current">
        <PlusIcon className="h-2 w-2" />
      </span>
      Add {label}
    </HBtn>
  )
}

// ---------------------------------------------------------------------------
// Per-card controls (redesign G4) — the ✕ remove (+ optional ⇄ swap) cluster
// rendered icon-only in the entity-card HEADER top-right via DisplayCard's
// card-level `controls` slot (never in the foot). The editing cue moves onto
// the CARD (REMOVABLE_CARD_STYLE), not these buttons.
// ---------------------------------------------------------------------------

type CardControlOptions = {
  /** Entity name for the accessible labels ("Remove {name}" / "Swap {name}"). */
  name: string
  onRemove: () => void
  /**
   * Optional single-select-replace swap. When provided a ⇄ control renders
   * before ✕. Deferred for most collections in Phase 1B (no replace handler
   * wired yet); ✕-only until then.
   */
  onSwap?: () => void
}

/**
 * Build the DisplayCard `controls` array for a removable entity card. Icon-only
 * controls (`icon` + no `label`) render as 28/32px squares by ControlButtons.
 */
// biome-ignore lint/style/useComponentExportOnlyModules: the card-controls factory is part of the edit-language vocabulary colocated with the section components
export function cardRemoveControls({
  name,
  onRemove,
  onSwap,
}: CardControlOptions): ReferenceEntityControl[] {
  const controls: ReferenceEntityControl[] = []
  if (onSwap) {
    controls.push({ key: 'swap', ariaLabel: `Swap ${name}`, icon: SwapIcon, onClick: onSwap })
  }
  controls.push({ key: 'remove', ariaLabel: `Remove ${name}`, icon: RemoveIcon, onClick: onRemove })
  return controls
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
    <Button
      size="xs"
      aria-label={`Remove ${name}`}
      onClick={onRemove}
      className={cn(EDIT_CUE_CLASS, 'min-h-11 sm:min-h-6 print:hidden', className)}
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
        align="center"
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
