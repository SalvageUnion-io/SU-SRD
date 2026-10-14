import { cn, KofiButton, MarkdownSection, Slab } from 'component-lib'
import { fontSize, space } from 'component-lib/design/tokens'
import type { CSSProperties } from 'react'

type ColophonProps = {
  /** Raw contents of the repo-root `ABOUT_JRVS.md` (left column, top). */
  aboutMarkdown: string
  /** Raw contents of the repo-root `LLM_STATEMENT.md` (right column). */
  llmMarkdown: string
  /** Raw contents of the repo-root `SPECIAL_THANKS.md` (left column, between
   * the bio and the support block). Same contract as `aboutMarkdown`. */
  specialThanksMarkdown: string
  /** Ko-fi page code — the `<code>` in `ko-fi.com/<code>`. */
  kofiCode: string
  /** Block modifiers (the page supplies its body colour/spacing). */
  className?: string
}

// Two columns from `md` up: the column template is `.srd-colophon`, the rest is
// static. Consumers' `className` adds spacing/colour, none of it these.
const ROOT = { display: 'grid', gap: space[32] } satisfies CSSProperties

const COLUMN = { display: 'flex', flexDirection: 'column', gap: space[32] } satisfies CSSProperties

const SUPPORT = {
  alignItems: 'flex-start',
  display: 'flex',
  flexDirection: 'column',
  fontSize: fontSize.sm,
  gap: space[12],
  lineHeight: 1.625,
} satisfies CSSProperties

/**
 * Colophon — who made this, how, and how to support it, on the About page
 * both tools share.
 *
 * Two columns that stack on narrow screens: the author bio, the special thanks
 * and the support section on the left, the LLM statement on the right. The
 * Ko-fi button rides in the support slab's `actions` slot, so it sits on the
 * heading line opposite the label rather than below it. None of the prose lives
 * here — all three are repo-root markdown documents passed in raw (see
 * `MarkdownSection`).
 *
 * The Ko-fi button needs client JS to swap in the widget, so the page hydrates
 * this block rather than render it statically, via `ColophonIsland`.
 */
export function Colophon({
  aboutMarkdown,
  llmMarkdown,
  specialThanksMarkdown,
  kofiCode,
  className,
}: ColophonProps) {
  return (
    <div className={cn('srd-colophon', className)} style={ROOT}>
      <div style={COLUMN}>
        <MarkdownSection markdown={aboutMarkdown} />

        <MarkdownSection markdown={specialThanksMarkdown} />

        <section style={SUPPORT}>
          <Slab
            as="h2"
            variant="solid"
            label="Support the Project"
            className="srd-colophon__support-slab"
            actions={<KofiButton code={kofiCode} />}
          />
        </section>
      </div>

      <MarkdownSection markdown={llmMarkdown} />
    </div>
  )
}
