import type { ElementType, HTMLAttributes, ReactNode } from 'react'
import { cn } from '../../utils/cn'
import { STAMP_SEAM } from './stampSeam'

export type StampSize = 'sm' | 'md' | 'lg'
export type StampSurface = 'on-ink' | 'inverse' | 'on-tone'

type StampProps = {
  children: ReactNode
  /** Text scale. `md` (default) is the label/header size. */
  size?: StampSize
  /**
   * The plate the stamp sits on:
   * - `on-ink` (default) — ink block, white text: the canonical label/header.
   * - `inverse` — paper block, ink text, inset ink ring.
   * - `on-tone` — no fill, ink text: a stamp sitting directly on a tone surface.
   */
  surface?: StampSurface
  /**
   * Ride the container's top border (StampSeam). Give the container `relative`;
   * pass the horizontal inset via `className` (e.g. `left-3`).
   */
  seam?: boolean
  as?: ElementType
  className?: string
} & Omit<HTMLAttributes<HTMLElement>, 'children' | 'className'>

const SIZE: Record<StampSize, string> = {
  sm: 'px-1 py-0.5 text-badge',
  md: 'px-1.5 py-0.5 text-xs',
  lg: 'px-2 py-1 text-sm',
}

const SURFACE: Record<StampSurface, string> = {
  'on-ink': 'bg-ink text-su-white',
  inverse: 'bg-paper text-ink ring-1 ring-inset ring-ink',
  'on-tone': 'bg-transparent text-ink',
}

/**
 * Stamp — the one ink label/header atom (ruleset §5, atom 1; §0 "stamps label").
 *
 * Ink block, white text, condensed-bold uppercase, tracking `0.04em`
 * (`tracking-caps-tight`), line-height 1. **Stamps are square** — no radius.
 * Every label, header, tab, and eyebrow is a Stamp; nothing else labels.
 *
 * The visual is shared with `Text variant="pseudoheader"`; Stamp is the named
 * atom that adds the `size` / `surface` / `seam` axes the ruleset prescribes.
 */
export function Stamp({
  children,
  size = 'md',
  surface = 'on-ink',
  seam = false,
  as: Tag = 'span',
  className,
  ...rest
}: StampProps) {
  return (
    <Tag
      className={cn(
        'inline-block w-fit font-cond font-bold uppercase leading-none tracking-caps-tight',
        SIZE[size],
        SURFACE[surface],
        seam && STAMP_SEAM,
        className
      )}
      style={{ lineHeight: 1 }}
      {...rest}
    >
      {children}
    </Tag>
  )
}
