import type { CSSProperties, ReactNode } from 'react'
import { borderWidth, color, font, fontSize, radius, space } from '../../design/tokens'
import { Badge } from './Badge'

type StampEmptyStateProps = {
  /** Default 'stamp' — the dashed, stamp-headlined empty slot. */
  variant?: 'stamp'
  /** The stamp headline (ruleset: "stamp voice"). */
  headline: string
  /** Explainer line under the headline. */
  body?: ReactNode
  /** A single rust action (usually a primary Button). */
  action?: ReactNode
  icon?: never
  className?: string
}

type QuietEmptyStateProps = {
  /**
   * 'quiet' — the muted app-chrome placeholder: centered, faint dashed frame,
   * decorative glyph, no stamp headline.
   */
  variant: 'quiet'
  headline?: never
  /** The muted message line. */
  body: ReactNode
  /** Decorative glyph above the message (e.g. an entity-tone lucide icon). */
  icon?: ReactNode
  /** CTA slot (usually a primary sm Button). */
  action?: ReactNode
  className?: string
}

type EmptyStateProps = StampEmptyStateProps | QuietEmptyStateProps

const FRAME = {
  display: 'flex',
  flexDirection: 'column',
  borderRadius: radius.card,
  borderStyle: 'dashed',
  borderWidth: borderWidth.chrome,
} satisfies CSSProperties

const QUIET = {
  ...FRAME,
  alignItems: 'center',
  justifyContent: 'center',
  gap: space[14],
  borderColor: color.wkFaint,
  padding: space[24],
  textAlign: 'center',
} satisfies CSSProperties

const STAMP = {
  ...FRAME,
  alignItems: 'flex-start',
  gap: space[12],
  borderColor: color.ink40,
  backgroundColor: color.paper,
  padding: space[16],
  textAlign: 'left',
} satisfies CSSProperties

const GLYPH = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
} satisfies CSSProperties

const BODY = {
  fontFamily: font.body,
  fontSize: fontSize.caption,
  color: color.wkMuted,
} satisfies CSSProperties

/**
 * EmptyState — the one empty-slot primitive (ruleset §"Empty state").
 *
 * Default ('stamp'): a **dashed** off-white panel (`dashed = fillable`), a
 * **Stamp** headline ("stamp voice"), an explainer, and **one rust action** —
 * **left-aligned**. Replaces ad-hoc muted-grey paragraphs.
 *
 * 'quiet': the muted app-chrome placeholder (design-spec §2.10 `.empty`):
 * 1.5px dashed faint frame, centered muted
 * message + CTA, with an optional decorative glyph on top.
 */
export function EmptyState({
  variant = 'stamp',
  headline,
  body,
  icon,
  action,
  className,
}: EmptyStateProps) {
  const quiet = variant === 'quiet'
  return (
    <div className={className} style={quiet ? QUIET : STAMP}>
      {quiet ? (
        icon && (
          <span aria-hidden="true" style={GLYPH}>
            {icon}
          </span>
        )
      ) : (
        <Badge shape="stamp" size="mini">
          {headline}
        </Badge>
      )}
      {body && <p style={BODY}>{body}</p>}
      {action}
    </div>
  )
}
