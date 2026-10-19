import { X } from 'lucide-react'
import type { ComponentPropsWithRef } from 'react'
import { iconSize } from '../../design/tokens'
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
}

/**
 * CLOSE BUTTON — the one ×: Button's icon rung (Compact) with a Compact `X` and a named
 * label, so every dialog, drawer and sheet closes on the same control. A
 * Base UI `Close` takes it through `render`, which adds its own click. On a
 * band that prints paper the frame says so (`data-ground="ink"`, chrome K1)
 * and the quiet glyph turns paper in CSS: no prop.
 */
export function CloseButton({
  label = 'Close',
  look = 'quiet',
  className,
  ...props
}: CloseButtonProps) {
  return (
    <Button
      variant={look === 'stamp' ? 'ink' : 'quiet'}
      size="iconOnly"
      className={cn('su-close-button', className)}
      aria-label={label}
      {...props}
    >
      <X size={iconSize.compact} aria-hidden="true" />
    </Button>
  )
}
