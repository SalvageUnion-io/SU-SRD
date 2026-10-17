import { X } from 'lucide-react'
import type { ComponentPropsWithRef, CSSProperties } from 'react'
import { space } from '../../design/tokens'
import { cn } from '../../lib/cn'
import { Button } from './Button'

type CloseButtonProps = Omit<ComponentPropsWithRef<'button'>, 'children'> & {
  /** The accessible name: "Close", "Close menu". */
  label?: string
  /**
   * `quiet`, the × on a band or bar; `stamp`, the ink square that straddles a
   * page's corner (the entity detail dialog).
   */
  look?: 'quiet' | 'stamp'
  /** The glyph prints paper, for a band or scrim that does (the danger rust, ink). */
  onPaper?: boolean
}

const GLYPH = { width: space[20], height: space[20] } satisfies CSSProperties

/**
 * CLOSE BUTTON — the one ×: Button's icon rung with a 20px glyph and a named
 * label, so every dialog, drawer and sheet closes on the same control. A
 * Base UI `Close` takes it through `render`, which adds its own click.
 */
export function CloseButton({
  label = 'Close',
  look = 'quiet',
  onPaper = false,
  className,
  ...props
}: CloseButtonProps) {
  return (
    <Button
      variant={look === 'stamp' ? 'ink' : 'quiet'}
      size="iconOnly"
      className={cn('su-close-button', className)}
      data-on-paper={onPaper || undefined}
      aria-label={label}
      {...props}
    >
      <X style={GLYPH} aria-hidden="true" />
    </Button>
  )
}
