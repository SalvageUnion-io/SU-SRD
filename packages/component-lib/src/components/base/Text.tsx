import { forwardRef } from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '../../utils/cn'

const textVariants = cva('', {
  variants: {
    variant: {
      default: 'font-mono text-[var(--foreground)]',
      pseudoheader:
        'block w-fit self-start bg-ink text-paper px-1 py-0.5 font-cond font-bold uppercase leading-tight tracking-caps-tight',
      pseudoheaderInverse:
        'block w-fit self-start bg-paper text-ink px-1 py-0.5 font-cond font-bold uppercase leading-tight tracking-caps-tight',
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
  as?: 'p' | 'span' | 'div' | 'label' | 'h1'
} & VariantProps<typeof textVariants> &
  Omit<React.HTMLAttributes<HTMLElement>, 'children' | 'style'>

export const Text = forwardRef<HTMLElement, TextProps>(function Text(
  { variant, children, className, style, as: Tag = 'p', ...props },
  ref
) {
  // Inline lineHeight ensures pseudoheader variants always get lineHeight: 1
  const isPseudoheader = variant === 'pseudoheader' || variant === 'pseudoheaderInverse'
  const textStyle = isPseudoheader ? { lineHeight: 1, ...style } : style
  return (
    <Tag
      ref={ref as React.Ref<never>}
      className={cn(textVariants({ variant }), className)}
      style={textStyle}
      {...props}
    >
      {children}
    </Tag>
  )
})
