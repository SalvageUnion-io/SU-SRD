import type { ReactNode } from 'react'

import { MarkdownSection } from '../../markdownSection/MarkdownSection'
import { cn } from '../../utils/cn'
import { KofiButton } from './KofiButton'

type ColophonProps = {
  /** Raw contents of the repo-root `ABOUT_JRVS.md` (left column). */
  aboutMarkdown: string
  /** Raw contents of the repo-root `LLM_STATEMENT.md` (right column). */
  llmMarkdown: string
  /** Ko-fi page code — the `<code>` in `ko-fi.com/<code>`. */
  kofiCode: string
  /** Optional line under the support button (ITUN puts its version there). */
  footer?: ReactNode
  /** Block modifiers (each app supplies its own body colour/alignment). */
  className?: string
  /** Heading modifiers, so both heads match their sibling sections per app. */
  headingClassName?: string
}

/**
 * Colophon — who made this and how, shared by both about pages.
 *
 * Author bio on the left, LLM statement on the right, support button beneath
 * them; the columns stack on narrow screens. Neither piece of prose lives here:
 * both are repo-root markdown documents passed in raw (see `MarkdownSection`),
 * so the two sites always show the same words.
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
  headingClassName,
}: ColophonProps) {
  return (
    <div className={cn('flex flex-col gap-8', className)}>
      <div className="grid gap-8 md:grid-cols-2">
        <MarkdownSection markdown={aboutMarkdown} headingClassName={headingClassName} />
        <MarkdownSection markdown={llmMarkdown} headingClassName={headingClassName} />
      </div>

      <div className="flex flex-col items-center gap-3">
        <KofiButton code={kofiCode} />
        {footer}
      </div>
    </div>
  )
}
