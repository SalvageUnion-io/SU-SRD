import type { CSSProperties } from 'react'
import { cn } from '../../utils/cn'

/**
 * Shared sizing/tracking for the card title pseudoheader. Used by CardHeader's
 * string-title branch AND by ReferenceEntityDisplayContent's titleNode (which
 * layers on the enlarge animation classes) so the size/tracking/lineHeight
 * literals live in exactly one place and can't drift on the next restyle.
 *
 * Kept in its own module (not CardHeader.tsx) so the component file only exports
 * components — required for React Fast Refresh.
 */
export function cardTitleClasses(compact: boolean, disabled?: boolean): string {
  return cn(
    // inline + box-decoration-clone: the black pseudoheader background hugs each
    // line fragment individually (like the .page-heading global style). The span
    // must be inline (not block) so it wraps naturally; relative/z-10 and
    // transition-transform still apply fine on display:inline.
    'inline box-decoration-clone',
    'uppercase tracking-[0.01em]',
    compact ? 'py-[3px] text-base' : 'text-[1.75rem]',
    disabled && 'opacity-50'
  )
}

export function cardTitleStyle(compact: boolean): CSSProperties | undefined {
  return compact ? { lineHeight: 1 } : undefined
}
