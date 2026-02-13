import { forwardRef } from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '../../utils/cn'

const textVariants = cva('font-mono', {
  variants: {
    variant: {
      default: 'text-[var(--foreground)]',
      pseudoheader:
        'inline self-start box-decoration-clone bg-su-black text-su-white px-1 font-bold uppercase leading-none tracking-tight',
      pseudoheaderInverse:
        'inline self-start box-decoration-clone bg-su-white text-su-black px-1 font-bold uppercase leading-none tracking-tight',
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
  as?: 'p' | 'span' | 'div' | 'label'
} & VariantProps<typeof textVariants> &
  Omit<React.HTMLAttributes<HTMLElement>, 'children' | 'style'>

export const Text = forwardRef<HTMLElement, TextProps>(function Text(
  { variant, children, className, style, as: Tag = 'p', ...props },
  ref
) {
  // Inline lineHeight overrides Chakra's @layer reset { * { font: inherit } }
  // which can override Tailwind utility classes due to CSS layer ordering
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
