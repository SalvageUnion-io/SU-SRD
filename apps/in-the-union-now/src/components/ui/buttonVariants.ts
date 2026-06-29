import { cva } from 'class-variance-authority'

/**
 * Button variants — ported from the suref-web SRD `.btn` system
 * (apps/suref-web/src/styles/global.css).
 *
 * Base recipe matches `.btn`: inline-flex layout, 0.375 rem rounding,
 * 0.875 rem / 500-weight Barlow text, 1 px transparent border that the
 * variants tint, 150 ms transition across color/bg/border.
 *
 * Variant mapping to the SRD's vocabulary:
 *   default     → `.btn-active` — orange-dark fill (primary action).
 *   outline     → `.btn-inactive` — transparent with hover-to-orange.
 *   ghost       → bare button; hover transitions to the orange fill.
 *   secondary   → muted blue-pale fill (matches the SRD's secondary chrome).
 *   destructive → rust fill (SU palette destructive, not red).
 *   link        → text-only, orange-dark with underline on hover.
 *
 * Focus ring uses `outline 2 px solid var(--color-su-orange)` with a 2 px
 * offset, mirroring `.btn:focus-visible` on the SRD.
 *
 * Exported separately from `Button` so consumers can compose the same
 * style on anchors/links (e.g. dashboard "+ Create" rows) without
 * tripping the react-refresh fast-refresh rule.
 */
export const buttonVariants = cva(
  [
    'inline-flex cursor-pointer select-none items-center justify-center gap-2 whitespace-nowrap',
    'rounded-md border text-sm font-medium leading-5',
    'transition-[color,background-color,border-color] duration-150',
    'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-su-orange)] focus-visible:ring-0',
    'disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50',
    '[&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0',
  ].join(' '),
  {
    variants: {
      variant: {
        default: [
          'border-[var(--color-su-orange-dark)] bg-[var(--color-su-orange-dark)] text-[var(--color-su-white)]',
          'hover:border-[var(--color-su-rust)] hover:bg-[var(--color-su-rust)]',
        ].join(' '),
        outline: [
          'border-[var(--color-su-black)] bg-transparent text-[var(--color-su-black)]',
          'hover:border-[var(--color-su-orange-dark)] hover:bg-[var(--color-su-orange-dark)] hover:text-[var(--color-su-white)]',
        ].join(' '),
        ghost: [
          'border-transparent bg-transparent text-[var(--color-su-black)]',
          'hover:border-[var(--color-su-orange-dark)] hover:bg-[var(--color-su-orange-dark)] hover:text-[var(--color-su-white)]',
        ].join(' '),
        secondary: [
          'border-[var(--color-su-blue)] bg-[var(--color-su-blue-pale)] text-[var(--color-su-black)]',
          'hover:border-[var(--color-su-blue-game)] hover:bg-[var(--color-su-blue-light)]',
        ].join(' '),
        destructive: [
          'border-[var(--color-su-rust)] bg-[var(--color-su-rust)] text-[var(--color-su-white)]',
          'hover:border-[var(--color-su-brick)] hover:bg-[var(--color-su-brick)]',
        ].join(' '),
        link: [
          'border-transparent bg-transparent text-[var(--color-su-orange-dark)] underline-offset-4',
          'hover:underline',
        ].join(' '),
      },
      size: {
        // min-h-11 (44px) on mobile keeps touch targets WCAG-compliant at the table.
        // sm:min-h-* restores the designed height on larger viewports.
        default: 'h-10 min-h-11 sm:min-h-10 px-4 py-1.5',
        sm: 'h-9 min-h-11 sm:min-h-9 px-3',
        lg: 'h-11 px-6',
        icon: 'h-10 w-10 min-h-11 sm:min-h-10',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
)
