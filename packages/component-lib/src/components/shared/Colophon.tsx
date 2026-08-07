import type { ReactNode } from 'react'
import { MarkdownSection } from '../../markdownSection/MarkdownSection'
import { cn } from '../../utils/cn'
import { Slab } from '../chrome/Slab'
import { KofiButton } from './KofiButton'

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
  /** Optional line under the support button (ITUN puts its version there). */
  footer?: ReactNode
  /** Block modifiers (each app supplies its own body colour/spacing). */
  className?: string
}

/**
 * Colophon — who made this, how, and how to support it; shared by both about
 * pages.
 *
 * Two columns that stack on narrow screens: the author bio, the special thanks
 * and the support section on the left, the LLM statement on the right. The
 * Ko-fi button rides in the support slab's `actions` slot, so it sits on the
 * heading line opposite the label rather than below it. None of the prose lives
 * here — all three are repo-root markdown documents passed in raw (see
 * `MarkdownSection`), so the two sites always show the same words.
 *
 * The Ko-fi button needs client JS to swap in the widget, so an Astro consumer
 * must hydrate this block rather than render it statically — srd does that via
 * `ColophonIsland`.
 */
export function Colophon({
  aboutMarkdown,
  llmMarkdown,
  specialThanksMarkdown,
  kofiCode,
  footer,
  className,
}: ColophonProps) {
  return (
    <div className={cn('grid gap-8 md:grid-cols-2', className)}>
      <div className="flex flex-col gap-8">
        <MarkdownSection markdown={aboutMarkdown} />

        <MarkdownSection markdown={specialThanksMarkdown} />

        <section className="flex flex-col items-start gap-3 text-sm leading-relaxed">
          <Slab
            as="h2"
            variant="solid"
            label="Support the Project"
            className="mb-0 w-full"
            actions={<KofiButton code={kofiCode} />}
          />
          {footer}
        </section>
      </div>

      <MarkdownSection markdown={llmMarkdown} />
    </div>
  )
}
