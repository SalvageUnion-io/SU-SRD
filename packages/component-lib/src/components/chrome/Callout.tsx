import type { ReactNode } from 'react'
import { cn } from '../../utils/cn'
import { Badge } from './Badge'

type CalloutProps = {
  /** Optional stamp header — rendered through the canonical Badge stamp atom. */
  label?: string
  /** Frame colour — the 3px solid border. Defaults to ink. */
  accent?: string
  /** Header-band background behind the label (a tint of the accent). Omit for no band. */
  headerBg?: string
  /** Compact spacing (dense listings / nested content). */
  compact?: boolean
  /** Body content — a paper panel under the header. */
  children?: ReactNode
  className?: string
}

/**
 * Callout — the accent-framed note in the "When Damaged" style: a 3px solid
 * accent border around an optional colour-banded stamp header and a paper body.
 * The one shape behind list-item content blocks (NPC motivations, "one of the
 * following" options, the settlement examples) and crawler-bay "When Damaged"
 * effects. Content-agnostic (a Container, not an Atom).
 */
export function Callout({
  label,
  accent = 'var(--color-ink)',
  headerBg,
  compact = false,
  children,
  className,
}: CalloutProps) {
  return (
    <div
      className={cn('overflow-hidden rounded-card', className)}
      style={{ border: `3px solid ${accent}` }}
    >
      {label && (
        <div
          className={cn('flex items-center', compact ? 'px-2 py-1' : 'px-3 py-1.5')}
          style={headerBg ? { backgroundColor: headerBg } : undefined}
        >
          <Badge shape="stamp" size={compact ? 'mini' : 'compact'}>
            {label}
          </Badge>
        </div>
      )}
      {children != null && (
        <div
          className={cn('bg-paper leading-snug text-ink', compact ? 'p-2 text-xs' : 'p-3 text-sm')}
        >
          {children}
        </div>
      )}
    </div>
  )
}
