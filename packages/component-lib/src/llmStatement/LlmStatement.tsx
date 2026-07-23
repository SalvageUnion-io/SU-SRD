import { PageHeading } from '../components/chrome/PageHeading'
import { cn } from '../utils/cn'
import { parseLlmStatement } from './parseLlmStatement'

type LlmStatementProps = {
  /** Raw contents of the repo-root `LLM_STATEMENT.md`. */
  markdown: string
  /** Section modifiers (each app supplies its own body colour/alignment). */
  className?: string
  /** Heading modifiers, so the head matches its sibling sections per app. */
  headingClassName?: string
}

/**
 * LlmStatement — the project's disclosure that it was built with LLM
 * assistance, rendered identically on both about pages.
 *
 * The wording is NOT held here: it lives in the repo-root `LLM_STATEMENT.md`
 * and is passed in as raw markdown, so the two sites cannot drift apart and the
 * statement can be edited without touching component code. This mirrors
 * `Changelog`, the other shared markdown-backed surface — the library stays
 * data-source agnostic, and each app reads the file the way its build allows
 * (srd via `node:fs`, ITUN via a Vite `?raw` import).
 */
export function LlmStatement({ markdown, className, headingClassName }: LlmStatementProps) {
  const { heading, paragraphs } = parseLlmStatement(markdown)

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
