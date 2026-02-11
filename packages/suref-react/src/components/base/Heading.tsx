import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '../../utils/cn'

const headingVariants = cva('font-mono font-bold self-start m-0', {
  variants: {
    level: {
      1: 'bg-su-black text-su-white px-2 leading-none inline-block w-fit text-[2em]',
      2: 'bg-su-black text-su-white px-2 leading-none inline-block w-fit text-[1.5em]',
      3: 'text-su-black text-[1.17em] leading-tight',
      4: 'text-su-black text-[1em] leading-tight',
      5: 'text-su-black text-[0.83em] leading-tight',
      6: 'text-su-black text-[0.67em] leading-tight',
    },
  },
  defaultVariants: {
    level: 2,
  },
})

type HeadingLevel = 1 | 2 | 3 | 4 | 5 | 6

type HeadingProps = {
  level?: HeadingLevel
  children: React.ReactNode
  className?: string
  style?: React.CSSProperties
} & VariantProps<typeof headingVariants> &
  Omit<React.HTMLAttributes<HTMLHeadingElement>, 'children' | 'style'>

export function Heading({ level = 2, children, className, style, ...props }: HeadingProps) {
  const Tag = `h${level}` as const
  // Inline lineHeight/margin overrides Chakra's @layer reset { * { font: inherit } }
  // which can override Tailwind utility classes due to CSS layer ordering
  const headingStyle = level <= 2 ? { lineHeight: 1, margin: 0, ...style } : { margin: 0, ...style }
  return (
    <Tag className={cn(headingVariants({ level }), className)} style={headingStyle} {...props}>
      {children}
    </Tag>
  )
}
