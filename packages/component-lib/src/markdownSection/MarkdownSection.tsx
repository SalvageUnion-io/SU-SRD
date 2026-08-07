import { Slab } from '../components/chrome/Slab'
import { cn } from '../utils/cn'
import { InlineMarkdown } from './InlineMarkdown'
import { parseMarkdownSection } from './parseMarkdownSection'

type MarkdownSectionProps = {
  /** Raw contents of a repo-root prose document. */
  markdown: string
  /** Section modifiers (each app supplies its own body colour/spacing). */
  className?: string
}

/**
 * MarkdownSection — a `#` heading plus its blocks, rendered from a raw markdown
 * string. The heading is a solid `Slab`, the canonical section head on the
 * about/back pages. Blocks are paragraphs and `- ` bullet lists;
 * `[label](href)` links are the only inline markdown interpreted.
 *
 * The prose is NOT held here: it lives in a repo-root document
 * (`ABOUT_JRVS.md`, `LLM_STATEMENT.md`, `SPECIAL_THANKS.md`) and is passed in raw, so the two sites
 * cannot drift apart and the wording can be edited without touching component
 * code. This mirrors `Changelog`, the other shared markdown-backed surface —
 * the library stays data-source agnostic, and each app reads the file the way
 * its build allows (srd via `node:fs`, ITUN via a Vite `?raw` import).
 */
export function MarkdownSection({ markdown, className }: MarkdownSectionProps) {
  const { heading, blocks } = parseMarkdownSection(markdown)

  return (
    <section className={cn('flex flex-col gap-3 text-sm leading-relaxed', className)}>
      {heading && <Slab as="h2" variant="solid" label={heading} className="mb-0" />}
      {blocks.map((block) =>
        block.kind === 'list' ? (
          <ul key={block.items.join('|')} className="flex list-disc flex-col gap-1 pl-5">
            {block.items.map((item) => (
              <li key={item}>
                <InlineMarkdown text={item} />
              </li>
            ))}
          </ul>
        ) : (
          <p key={block.text}>
            <InlineMarkdown text={block.text} />
          </p>
        )
      )}
    </section>
  )
}
