import type { CSSProperties, ReactNode } from 'react'
import { cn } from '../../lib/cn'

export type BoxProps = {
  /** The band over the body: `TitledBox`'s cut-out head. Omitted, the box is its frame and body. */
  head?: ReactNode
  /** A column left of the head and body, ruled off in ink: a Row's art. */
  art?: ReactNode
  /** The frame's colour token value (`var(--color-…)`); ink by default. */
  frameColor?: string
  /** The landmark: `section` (named by `label`) or a plain `div`. */
  as?: 'section' | 'div'
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
  children?: ReactNode
}

/**
 * BOX — the house container: the Row's square 2px frame around a paper body
 * (ruleset §4.3), with an optional head band and art column. Its named
 * variants: `TitledBox` (the cut-out head: dialogs, briefs, notices), and on
 * that `Inset`, `InfoCutout`, a labelled `Callout`, `RecoveryPanel`; an
 * unlabelled `Callout` is the bare box in its accent. A box with nothing
 * below its head closes on it.
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
  children,
}: BoxProps) {
  const hasBody = children !== null && children !== undefined && children !== false
  return (
    <Root
      aria-label={Root === 'section' ? label : undefined}
      role={role}
      className={cn('su-entity-row su-box', className)}
    >
      <div
        className="su-entity-row__frame"
        data-bodyless={hasBody ? undefined : true}
        style={frameColor ? { borderColor: frameColor } : undefined}
      >
        {art}
        <div className="su-entity-row__main">
          {head}
          {hasBody && (
            <div
              className={cn('su-box__body', bodyClassName)}
              data-flush={body === 'flush' || undefined}
              style={bodyStyle}
            >
              {children}
            </div>
          )}
        </div>
      </div>
    </Root>
  )
}
