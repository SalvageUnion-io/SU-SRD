import { PageHeading } from '../components/chrome/PageHeading'
import { cn } from '../utils/cn'
import { parseMarkdownSection } from './parseMarkdownSection'

type MarkdownSectionProps = {
  /** Raw contents of a repo-root prose document. */
  markdown: string
  /** Section modifiers (each app supplies its own body colour/alignment). */
  className?: string
  /** Heading modifiers, so the head matches its sibling sections per app. */
  headingClassName?: string
}

/**
 * MarkdownSection — a `#` heading plus its paragraphs, rendered from a raw
 * markdown string.
 *
 * The prose is NOT held here: it lives in a repo-root document
 * (`ABOUT_JRVS.md`, `LLM_STATEMENT.md`) and is passed in raw, so the two sites
 * cannot drift apart and the wording can be edited without touching component
 * code. This mirrors `Changelog`, the other shared markdown-backed surface —
 * the library stays data-source agnostic, and each app reads the file the way
 * its build allows (srd via `node:fs`, ITUN via a Vite `?raw` import).
 */
export function MarkdownSection({ markdown, className, headingClassName }: MarkdownSectionProps) {
  const { heading, paragraphs } = parseMarkdownSection(markdown)

  return (
    <section className={cn('flex flex-col gap-3 text-sm leading-relaxed', className)}>
      {heading && (
        <PageHeading variant="subheading" className={headingClassName}>
          {heading}
        </PageHeading>
      )}
      {paragraphs.map((paragraph) => (
        <p key={paragraph}>{paragraph}</p>
      ))}
    </section>
  )
}
