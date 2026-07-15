/**
 * SectionCard — ITUN's "black-header card": a bordered bg-paper frame with a
 * bg-ink head bar (font-cond caps title + optional right-side hint slot) over
 * a body. Consolidates the idiom previously hand-inlined across the salvage /
 * crafting / hold panels, the encounter tray sections, and the NPC insets
 * (visual review finding #4).
 *
 * Two variants — the weight difference is intentional, not drift:
 * - `panel` (default) — bordered TOOL PANELS (salvage & crafting rollers,
 *   encounter-tray sections, hold manifests): 2px ink frame (the pill weight,
 *   design-spec §1.3), rounded-[3px], px-3 head; `title`/`hint` get the
 *   standard caps typography (title text-xs tracking-wider, hint muted).
 * - `card` — TRACKED-ENTITY insets (crawler crew leads, encounter NPCs):
 *   chrome (1.5px) frame, rounded-[2px], px-2 wrapping head; `title` renders
 *   raw so callers compose the tag + editable-name anatomy, and `hint` is
 *   pushed to the right edge (`ml-auto`) of the bar.
 *
 * RULING (visual review finding #5): ITUN deliberately has TWO section-header
 * dialects. `Slab` (suref-react, tone-deep caps label with a dashed leader)
 * marks inline sections WITHIN a live sheet and its roll controls — open,
 * borderless, part of the page flow. SectionCard's closed ink bar frames
 * self-contained tool panels and tracked-entity cards. The open-leader vs
 * closed-ink-bar contrast is the design — do NOT "unify" them into one header
 * component.
 */

import type { ReactNode } from 'react'

import { cn } from '../../lib/utils'

type SectionCardVariant = 'panel' | 'card'

type SectionCardProps = {
  /**
   * Head-bar title. `panel`: wrapped in the standard caps typography (pass a
   * plain string). `card`: rendered as-is — compose your own tag/name spans.
   */
  title: ReactNode
  /**
   * Optional right-side head slot. `panel`: muted caps text, truncates.
   * `card`: raw content on the right edge of the bar (meta text, buttons).
   */
  hint?: ReactNode
  variant?: SectionCardVariant
  /** Root element — `section` for document-outline sections. */
  as?: 'div' | 'section'
  /** Panel-title element — `h2` when the title belongs in the outline. */
  titleAs?: 'span' | 'h2'
  /** Skip the padded body wrapper (bodies that manage their own strips/lists). */
  unpaddedBody?: boolean
  /** Extra classes on the padded body wrapper (e.g. `flex flex-col gap-2.5`). */
  bodyClassName?: string
  /** Extra classes on the root frame (e.g. a panel shadow). */
  className?: string
  'aria-label'?: string
  children: ReactNode
}

const FRAME: Record<SectionCardVariant, string> = {
  panel: 'overflow-hidden rounded-[3px] border-2 border-ink bg-paper',
  card: 'overflow-hidden rounded-[2px] border-chrome border-ink bg-paper',
}

const HEAD: Record<SectionCardVariant, string> = {
  panel: 'flex items-center justify-between gap-2 bg-ink px-3 py-1.5',
  card: 'flex flex-wrap items-center gap-2 bg-ink px-2 py-1.5',
}

const BODY_PAD: Record<SectionCardVariant, string> = {
  panel: 'px-3 py-2.5',
  card: 'p-2.5',
}

export function SectionCard({
  title,
  hint,
  variant = 'panel',
  as: Root = 'div',
  titleAs: TitleTag = 'span',
  unpaddedBody = false,
  bodyClassName,
  className,
  'aria-label': ariaLabel,
  children,
}: SectionCardProps) {
  return (
    <Root aria-label={ariaLabel} className={cn(FRAME[variant], className)}>
      <div className={HEAD[variant]}>
        {variant === 'panel' ? (
          <TitleTag className="m-0 font-cond text-xs font-bold uppercase tracking-wider text-paper">
            {title}
          </TitleTag>
        ) : (
          title
        )}
        {hint != null &&
          (variant === 'panel' ? (
            <span className="min-w-0 truncate font-cond text-xs uppercase text-paper/60">
              {hint}
            </span>
          ) : (
            <span className="ml-auto flex shrink-0 items-center gap-1.5">{hint}</span>
          ))}
      </div>
      {unpaddedBody ? (
        children
      ) : (
        <div className={cn(BODY_PAD[variant], bodyClassName)}>{children}</div>
      )}
    </Root>
  )
}
