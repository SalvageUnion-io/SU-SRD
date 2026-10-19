import type { CSSProperties, ReactNode } from 'react'
import { cn } from '../../lib/cn'
import { RowFrame } from '../entity/forms/RowFrame'
import { ROW_ROOT } from '../entity/forms/rowRoot'
import { SelectSurface } from '../entity/modes/select'
import { SELECTED_RING } from '../entity/modes/selectedRing'
import type { EntityMode } from '../entity/types'

/** A level-1 pick that is no entity: the Row's select mode on its frame. */
type BoxSelect = Extract<EntityMode, { kind: 'select' }>

export type BoxProps = {
  /** The band over the body: `TitledBox`'s cut-out head. Omitted, the box is its frame and body. */
  head?: ReactNode
  /** A column left of the head and body, ruled off in ink: a Row's art. */
  art?: ReactNode
  /** The frame's colour token value (`var(--color-…)`); ink by default. */
  frameColor?: string
  /** The landmark: `section` (named by `label`), an `article`, or a plain `div`. */
  as?: 'section' | 'article' | 'div'
  /** Names a `section`. */
  label?: string
  /** A role on the root (`alert`, `note`). */
  role?: string
  /**
   * The paper body's padding: `padded` (12px, a 12px gap between blocks) or
   * `flush`, for content that rules its own bands or pads itself.
   */
  body?: 'padded' | 'flush'
  /** Inline style on the paper body (a grid, a type size). */
  bodyStyle?: CSSProperties
  /** Classes on the root (a grid span, a print rule, a host's band overrides). */
  className?: string
  /** Classes on the paper body. */
  bodyClassName?: string
  /** A Play reference unit (ADR-051 §5): its frame dashed, read-only. */
  reference?: boolean
  /** Fill the parent's height, the body scrolling in what is left under the head. */
  fill?: boolean
  /**
   * Shrink with a root whose height is capped (a dialog's `max-height`): the
   * frame gives way, and the body manages what is left (`fill` implies it).
   */
  shrink?: boolean
  /** Dimmed by its host: a Play row not on hand (the Row's `dim`). */
  dim?: boolean
  /**
   * Select mode (EDL Modes), for a level-1 pick that is no entity (a wizard's
   * Custom build, an NPC's Start blank): the whole box is the surface, a radio
   * or a toggle, and selected it wears the Row's ink ring. `TitledBox` seals
   * its head.
   */
  select?: BoxSelect
  children?: ReactNode
}

/**
 * BOX — the house container: the Row's square 2px frame around a paper body
 * (ruleset §4.3), with an optional head band and art column. It stands in the
 * Row's own frame (`RowFrame`), so it draws no entity markup of its own (EDL
 * E15, hard rule R7). Its named
 * variants: `TitledBox` (the cut-out head: dialogs, briefs, notices), and on
 * that a labelled `Callout` and `RecoveryPanel`; an
 * unlabelled `Callout` is the bare box in its accent. A box with nothing
 * below its head closes on it. No headed box sits inside an entity or around
 * a wizard step's entities (ruleset §5, N5 and N6): there a note is the
 * unlabelled `Callout`, a section a `Slab`.
 */
export function Box({
  head,
  art,
  frameColor,
  as: Root = 'div',
  label,
  role,
  body = 'padded',
  bodyStyle,
  className,
  bodyClassName,
  reference = false,
  fill = false,
  shrink = false,
  dim = false,
  select,
  children,
}: BoxProps) {
  const hasBody = children !== null && children !== undefined && children !== false
  const frame = (
    <RowFrame
      art={art}
      bodyless={!hasBody}
      reference={reference}
      shrink={fill || shrink}
      dim={dim}
      style={
        frameColor || select?.selected
          ? {
              ...(frameColor ? { borderColor: frameColor } : {}),
              ...(select?.selected && SELECTED_RING),
            }
          : undefined
      }
    >
      {head}
      {hasBody && (
        <div
          className={cn('su-box__body', bodyClassName)}
          data-flush={body === 'flush' || undefined}
          data-fill={fill || undefined}
          style={bodyStyle}
        >
          {children}
        </div>
      )}
    </RowFrame>
  )
  if (select) {
    return (
      <SelectSurface
        mode={select}
        label={select.label ?? label ?? ''}
        className={cn(ROW_ROOT, 'su-box', className)}
      >
        {frame}
      </SelectSurface>
    )
  }
  return (
    <Root
      aria-label={Root === 'section' ? label : undefined}
      role={role}
      className={cn(ROW_ROOT, 'su-box', className)}
      data-fill={fill || undefined}
    >
      {frame}
    </Root>
  )
}
