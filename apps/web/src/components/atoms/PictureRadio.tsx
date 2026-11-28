import type { ComponentPropsWithRef } from 'react'
import { cn } from '../../lib/cn'
import { FOCUS_RING } from './interaction'

/**
 * PictureRadio — one choice of a picture-led pick (the wizard's chassis
 * gallery, hard rule R16): a plate the whole of which is the radio, its art
 * and name inside. Its group is a `role="radiogroup"`; the plate carries the
 * one focus ring.
 */
export function PictureRadio({
  checked,
  className,
  children,
  ...button
}: Omit<ComponentPropsWithRef<'button'>, 'type' | 'role' | 'aria-checked'> & {
  checked: boolean
}) {
  return (
    // biome-ignore lint/a11y/useSemanticElements: a picture plate is a button-shaped radio, not a native input
    <button
      type="button"
      role="radio"
      aria-checked={checked}
      className={cn(FOCUS_RING, className)}
      {...button}
    >
      {children}
    </button>
  )
}
