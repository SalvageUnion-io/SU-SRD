/**
 * Text is the PROSE primitive — running copy, reference paragraphs, asides.
 *
 * It deliberately has no stamp/label variant. The square ink label is
 * `Badge shape="stamp"` and nothing else (ruleset §0: one kind × one context =
 * one primitive), with `surface="on-ink"` / `"inverse"` for the dark grounds.
 * Badge is label-only (uppercase, condensed, `w-fit`, `leading-none`) and is
 * the wrong shape for wrapping prose — which is why Text exists.
 */
type TextVariant = 'default' | 'body' | 'hint' | 'flavor'

/**
 * Each variant is a `.su-text--*` class in `styles/index.css`, not a style
 * object: callers restyle Text through `className` all the time (`text-paper`,
 * `text-sm`, `text-left`, `mb-2`…), and an inline style would beat every one of
 * those utilities. A stylesheet class keeps them winning, as tailwind-merge
 * made them win before.
 *
 *   default  the body face in the page foreground
 *   body     body prose — reference-content paragraphs / labelled values
 *   hint     a centered italic aside (a rules "hint" / tip)
 *   flavor   italic flavour text in `ink-2`, the second rung of BODY ink — prose
 *            to be read, set one step back from primary, not a de-emphasised
 *            label (`wk-muted` owns de-emphasised secondary copy)
 */
const VARIANT_CLASS: Record<TextVariant, string> = {
  default: 'su-text su-text--default',
  body: 'su-text su-text--body',
  hint: 'su-text su-text--hint',
  flavor: 'su-text su-text--flavor',
}

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
  ref?: React.Ref<HTMLElement>
  variant?: TextVariant | null
} & Omit<React.HTMLAttributes<HTMLElement>, 'children' | 'style'>

export function Text({
  variant,
  children,
  className,
  style,
  as: Tag = 'p',
  ref,
  ...props
}: TextProps) {
  return (
    <Tag
      ref={ref as React.Ref<never>}
      className={
        className
          ? `${VARIANT_CLASS[variant ?? 'default']} ${className}`
          : VARIANT_CLASS[variant ?? 'default']
      }
      style={style}
      {...props}
    >
      {children}
    </Tag>
  )
}
