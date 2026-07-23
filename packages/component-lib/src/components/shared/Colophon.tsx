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
 * Two columns that stack on narrow screens: the author bio and the support
 * button on the left, the LLM statement on the right. Neither piece of prose
 * lives here — both are repo-root markdown documents passed in raw (see
 * `MarkdownSection`), so the two sites always show the same words.
 *
 * The Ko-fi button needs client JS to swap in the widget, so an Astro consumer
 * must hydrate this block rather than render it statically — srd does that via
 * `ColophonIsland`.
 */
export function Colophon({
  aboutMarkdown,
  llmMarkdown,
  kofiCode,
  footer,
  className,
}: ColophonProps) {
  return (
    <div className={cn('grid gap-8 md:grid-cols-2', className)}>
      <div className="flex flex-col gap-8">
        <MarkdownSection markdown={aboutMarkdown} />

        <section className="flex flex-col items-start gap-3 text-sm leading-relaxed">
          <Slab as="h2" variant="solid" label="Support the Project" className="mb-0 self-stretch" />
          <KofiButton code={kofiCode} />
          {footer}
        </section>
      </div>

      <MarkdownSection markdown={llmMarkdown} />
    </div>
  )
}
