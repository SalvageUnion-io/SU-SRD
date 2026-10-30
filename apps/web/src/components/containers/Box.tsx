import type { CSSProperties, ReactNode } from 'react'
import { borderWidth } from '../../design/tokens'
import { cn } from '../../lib/cn'
import { CompactFrame } from '../entity/forms/CompactFrame'
import { ROW_ROOT } from '../entity/forms/rowRoot'
import { SelectSurface } from '../entity/modes/select'
import { SELECTED_RING } from '../entity/modes/selectedRing'
import type { EntityMode } from '../entity/types'

/** `frame="hairline"`: one light hairline all round, in place of the Compact's weight. */
const HAIRLINE = { borderWidth: borderWidth.hairline } satisfies CSSProperties

/**
 * A level-1 pick that is no entity: the Compact's select mode on its frame,
 * as a radio. A `toggle` surface takes its keyboard path from the
 * `SelectCheck` in a Compact's head, which a Box has none of, so a Box picks
 * only as one card of a `RadioCardGroup`.
 */
type BoxSelect = Extract<EntityMode, { kind: 'select' }> & { role: 'radio' }

export type BoxProps = {
  /** The band over the body: `TitledBox`'s cut-out head. Omitted, the box is its frame and body. */
  head?: ReactNode
  /**
   * The frame's colour token value (`var(--color-…)`), set through
   * `--su-compact-frame`, the hook that overrides a frame's colour (R38); the subtle
   * ink-40 by default.
   */
  frameColor?: string
  /**
   * The frame's weight: the Compact's (`compact`), or one light hairline all
   * round (`hairline`), the quiet frame of a live sheet's opening panels (R49),
   * so the sheet's content carries the weight.
   */
  frame?: 'compact' | 'hairline'
  /** The landmark: `section` (named by `label`), an `article`, or a plain `div`. Not with `select`, whose root is the radio. */
  as?: 'section' | 'article' | 'div'
  /** Names a `section`, or a `select` radio that has no `label` of its own. */
  label?: string
  /** A role on the root (`alert`, `note`). Not with `select`, whose role is `radio`. */
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
  /** Player-made (ruleset §3.9): its frame dashed, as the Compact's (a pattern's maker's notes). */
  userMade?: boolean
  /** Fill the parent's height, the body scrolling in what is left under the head. */
  fill?: boolean
  /**
   * Shrink with a root whose height is capped (a dialog's `max-height`): the
   * frame gives way, and the body manages what is left (`fill` implies it).
   */
  shrink?: boolean
  /**
   * Select mode (EDL Modes), for a level-1 pick that is no entity (a wizard's
   * Custom build, an NPC's Start blank): the whole box is the surface, a radio,
   * and selected it wears the Compact's ink ring. `TitledBox` seals its head.
   */
  select?: BoxSelect
  children?: ReactNode
}

/**
 * BOX — the house container: the Compact's square 2px frame around a paper body
 * (ruleset §4.3), with an optional head band. It stands in the
 * Compact's own frame (`CompactFrame`), so it draws no entity markup of its own (EDL
 * E15, hard rule R7). Its named
 * variants: `TitledBox` (the cut-out head: dialogs, briefs, notices), and on
 * that `RecoveryPanel`; a `Callout` is the bare box in its accent. A box with
 * nothing below its head closes on it. No headed box sits inside an entity or around
 * a wizard step's entities (ruleset §5, N5 and N6): there a note is the
 * unlabelled `Callout`, a section a `Slab`.
 */
export function Box({
  head,
  frameColor,
  frame: weight = 'compact',
  as: Root = 'div',
  label,
  role,
  body = 'padded',
  bodyStyle,
  className,
  bodyClassName,
  reference = false,
  userMade = false,
  fill = false,
  shrink = false,
  select,
  children,
}: BoxProps) {
  const hasBody = children !== null && children !== undefined && children !== false
  const frame = (
    <CompactFrame
      bodyless={!hasBody}
      reference={reference}
      userMade={userMade}
      shrink={fill || shrink}
      style={
        weight === 'hairline' || frameColor || select?.selected
          ? {
              ...(weight === 'hairline' ? HAIRLINE : {}),
              ...(frameColor ? ({ '--su-compact-frame': frameColor } as CSSProperties) : {}),
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
    </CompactFrame>
  )
  if (select) {
    return (
      <SelectSurface
        mode={select}
        label={select.label ?? label ?? ''}
        className={cn(ROW_ROOT, 'su-box', className)}
        fill={fill}
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
