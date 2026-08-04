import type { VariantProps } from 'class-variance-authority'
import { cva } from 'class-variance-authority'
import { forwardRef } from 'react'
import { cn } from '../../utils/cn'

/**
 * Text is the PROSE primitive — running copy, reference paragraphs, asides.
 *
 * It deliberately has no stamp/label variant. The square ink label is
 * `Badge shape="stamp"` and nothing else (ruleset §0: one kind × one context =
 * one primitive). The former `pseudoheader` / `pseudoheaderInverse` variants
 * rendered exactly that stamp, so two primitives owned one visual; they were
 * retired onto `Badge shape="stamp"` with `surface="on-ink"` / `"inverse"`.
 * Badge is label-only (uppercase, condensed, `w-fit`, `leading-none`) and is
 * the wrong shape for wrapping prose — which is why Text survives.
 */
const textVariants = cva('', {
  variants: {
    variant: {
      default: 'font-body text-[var(--foreground)]',
      // Body prose — reference-content paragraphs / labelled values.
      body: 'break-words font-medium leading-snug whitespace-normal text-pretty text-ink',
      // Centered italic aside (a rules "hint" / tip).
      hint: 'max-w-full overflow-hidden break-words text-center font-normal italic leading-snug whitespace-normal text-pretty text-ink',
      // Muted italic flavour text.
      flavor:
        'break-words font-normal italic leading-snug whitespace-normal text-pretty text-ink-2',
    },
  },
  defaultVariants: {
    variant: 'default',
  },
})

type TextProps = {
  children: React.ReactNode
  className?: string
  style?: React.CSSProperties
  /**
   * The element to render as.
   *
   * The heading levels go to `h3` because a page needs more than one rung: an
   * h1 page title over h2 sections over h3 sub-sections. Stopping at `h1` meant
   * a surface that wanted a real hierarchy had to drop out of this primitive
   * and hand-roll a bare `<h2>`, which is how the Game surface ended up with an
   * h1 and a set of orphaned h3s and nothing in between.
   */
  as?: 'p' | 'span' | 'div' | 'label' | 'h1' | 'h2' | 'h3'
} & VariantProps<typeof textVariants> &
  Omit<React.HTMLAttributes<HTMLElement>, 'children' | 'style'>

export const Text = forwardRef<HTMLElement, TextProps>(function Text(
  { variant, children, className, style, as: Tag = 'p', ...props },
  ref
) {
  return (
    <Tag
      ref={ref as React.Ref<never>}
      className={cn(textVariants({ variant }), className)}
      style={style}
      {...props}
    >
      {children}
    </Tag>
  )
})
