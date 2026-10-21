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
 *   (B) COLLECTION sections: a `Button` in the `SlabSection`'s `actions`
 *       ("Manage Abilities"), always visible and always ENABLED, opening the
 *       ONE shared picker modal (`SheetPickerModal` over ModalShell); the
 *       per-item remove (✕) is the sheet's one `SheetRemoveButton`
 *       (`SheetItemLine.tsx`). There is no header button of the sheets' own:
 *       the Manage control is the house `Button`, Compact as the fold beside
 *       it (§4.7). Free Edit: add/remove is not rule-gated (ADR-021).
 *   (C) STAT cells stay always-live StatBlock pips — no primitive needed here.
 *
 * `EDIT_CUE_HOVER_CLASS` is the single editing cue: a dashed outline on
 * section-edit fields and per-card controls (StatBlocks carry no cue).
 */

import type { CSSProperties, ReactElement, ReactNode } from 'react'
import { cloneElement, isValidElement } from 'react'
import { ModalShell, tokens } from '../../components/index'

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
 * through on toggle (The app auto-saves; there is no Save button).
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
        width="page"
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
      width="default"
    >
      <div style={PICKER_BODY}>{children}</div>
    </ModalShell>
  )
}
