/**
 * SheetSection — the UNIFIED EDIT LANGUAGE primitives shared by all three
 * live sheets (redesign plan: three interaction archetypes, one editing cue,
 * one shared picker modal).
 *
 *   (A) FIELD sections: no primitive. This archetype was to have a
 *       `SectionEditButton` per-section Edit/Done toggle, flipping only its own
 *       fields into inline-edit. It was built and exported, and then never
 *       adopted by any sheet — the sheets edit fields live instead — so it was
 *       deleted rather than left as half a shipped API. Its (B) sibling below
 *       IS used; that asymmetry is why this note exists rather than a silent gap.
 *   (B) COLLECTION sections: `SectionAddButton` — an always-visible,
 *       always-ENABLED '+ Add' opening the ONE shared picker modal
 *       (`SheetPickerModal` over ModalShell); `CardRemoveButton` is the
 *       per-card remove (✕) control.
 *   (C) STAT cells stay always-live StatBlock pips — no primitive needed here.
 *
 * `EDIT_CUE_HOVER_CLASS` is the single editing cue: a dashed outline on
 * section-edit fields and per-card controls (StatBlocks carry no cue).
 */

import { Button, Glyph, ModalShell, PICKER_MODAL_WIDTH, tokens } from 'component-lib'
import type { ComponentPropsWithoutRef, CSSProperties, ReactElement, ReactNode } from 'react'
import { cloneElement, isValidElement } from 'react'

// ---------------------------------------------------------------------------
// HButton — the container-header control button (design `.hbtn`, clean-edit.html
// :384-411). 2px border, radius 3, paper fill, 10.5px cond bold caps: a
// deep-tone outline with a circled-plus that fills on hover. The 44px
// coarse-pointer floor collapses to the 32px design height at `sm`.
//
// Everything with a hover, breakpoint or print variant — display, min-height
// and the colours — is `.su-sheet-hbtn` in `styles/sheet/chrome.css`; the rest
// is the style object below, which sits over `Button`'s own geometry.
// ---------------------------------------------------------------------------

const HBTN = {
  cursor: 'pointer',
  alignItems: 'center',
  gap: tokens.space[6],
  borderRadius: tokens.radius.card,
  borderStyle: 'solid',
  borderWidth: tokens.borderWidth.pill,
  paddingBlock: 0,
  paddingInline: tokens.space[12],
  fontFamily: tokens.font.cond,
  fontSize: tokens.fontSize.badge,
  fontWeight: tokens.weight.bold,
  textTransform: 'uppercase',
  lineHeight: 1,
  letterSpacing: tokens.tracking.capsWide,
  whiteSpace: 'nowrap',
  transitionProperty:
    'color, background-color, border-color, outline-color, text-decoration-color, fill, stroke',
  transitionTimingFunction: 'cubic-bezier(0.4, 0, 0.2, 1)',
  transitionDuration: '150ms',
} satisfies CSSProperties

/** Container-header control button (design `.hbtn`). */
function HButton({ children, ...props }: ComponentPropsWithoutRef<'button'>) {
  return (
    <Button className="su-sheet-hbtn" style={HBTN} {...props}>
      {children}
    </Button>
  )
}

// ---------------------------------------------------------------------------
// (B) COLLECTION sections — always-available add / per-card remove
// ---------------------------------------------------------------------------

type SectionManageButtonProps = {
  /** What gets added, for the accessible label, e.g. 'ability'. */
  label: string
  onClick: () => void
}

/** The circled plus: a 16px ring in the button's own colour. */
const MANAGE_RING = {
  display: 'flex',
  height: tokens.space[16],
  width: tokens.space[16],
  alignItems: 'center',
  justifyContent: 'center',
  borderRadius: tokens.radius.full,
  border: `${tokens.borderWidth.pill} solid currentColor`,
} satisfies CSSProperties

const MANAGE_GLYPH = { height: tokens.space[8], width: tokens.space[8] } satisfies CSSProperties

/**
 * Always-visible, always-ENABLED '+ Add' for a collection section header.
 * // TODO(redesign): rule-gate add/remove (TP / maxAbilities / slots / scrap
 * economy) — deferred; users self-manage for now.
 */
export function SectionManageButton({ label, onClick }: SectionManageButtonProps) {
  return (
    <HButton aria-label={`Manage ${label.toLowerCase()}`} onClick={onClick}>
      <span style={MANAGE_RING}>
        <Glyph name="plus" style={MANAGE_GLYPH} />
      </span>
      Manage {label}
    </HButton>
  )
}

// ---------------------------------------------------------------------------
// Per-card controls (redesign G4) — `CardRemoveButton` is the standalone ✕
// remove button. The shared editing cue lives in `./editLanguage` (a
// components-free module).
// ---------------------------------------------------------------------------

type CardRemoveButtonProps = {
  /** The card's entity name, for the accessible label. */
  name: string
  onRemove: () => void
}

/** Per-card remove (✕) control — always available; carries the editing cue. */
export function CardRemoveButton({ name, onRemove }: CardRemoveButtonProps) {
  return (
    <Button
      size="mini"
      variant="danger"
      aria-label={`Remove ${name}`}
      onClick={onRemove}
      className="su-sheet-remove"
    >
      &#10005; Remove
    </Button>
  )
}

// ---------------------------------------------------------------------------
// The ONE shared picker modal (collections + single-select pickers)
// ---------------------------------------------------------------------------

const PICKER_BODY = {
  backgroundColor: tokens.color.paper,
  padding: tokens.space[20],
} satisfies CSSProperties

type SheetPickerModalProps = {
  open: boolean
  onClose: () => void
  title: string
  /**
   * The searcher-picker layout: render a BARE ModalShell and hand the single
   * `EntitySearcher` child its own frame by injecting this modal's
   * `title`/`onClose`. (The default framed layout stays for picker bodies that
   * are not a searcher and so need this modal's own frame.)
   */
  floating?: boolean
  children: ReactNode
}

/**
 * The single shared picker modal every collection '+ Add' (and single-select
 * swap) opens — never hand-roll per-sheet dialogs. Multi-select pickers write
 * through on toggle (The Cantina auto-saves; there is no Save button).
 *
 * There is deliberately **no `footer` prop.** It existed for the master/detail
 * single-select pickers' confirm buttons, and became a trap once they migrated
 * to `EntitySearcher`: the `floating` branch returns before rendering a footer,
 * so a `floating` + `footer` call would have silently dropped its confirm
 * buttons — invisible to both typecheck and knip. A floating picker puts its
 * actions in the searcher's own `railActions` slot instead, beneath the
 * selection it is confirming.
 */
export function SheetPickerModal({
  open,
  onClose,
  title,
  floating = false,
  children,
}: SheetPickerModalProps) {
  // Floating searcher-picker: a BARE ModalShell; the child EntitySearcher owns
  // the whole frame (header + search + close + internal scroll + its rail).
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
        maxWidth={PICKER_MODAL_WIDTH}
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
      // 80% of the viewport for a framed picker body.
      maxWidth="su-sheet-picker-framed"
    >
      <div style={PICKER_BODY}>{children}</div>
    </ModalShell>
  )
}
