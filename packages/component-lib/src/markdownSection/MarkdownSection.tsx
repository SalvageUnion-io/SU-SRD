import { Fragment } from 'react'

import { Slab } from '../components/chrome/Slab'
import { cn } from '../utils/cn'
import { type InlineNode, parseInline, parseMarkdownSection } from './parseMarkdownSection'

/** Pair each run with its start offset in the paragraph — a stable React key. */
function withOffsets(nodes: InlineNode[]): Array<{ node: InlineNode; offset: number }> {
  let offset = 0
  return nodes.map((node) => {
    const at = offset
    offset += node.text.length
    return { node, offset: at }
  })
}

type MarkdownSectionProps = {
  /** Raw contents of a repo-root prose document. */
  markdown: string
  /** Section modifiers (each app supplies its own body colour/spacing). */
  className?: string
}

/**
 * MarkdownSection — a `#` heading plus its paragraphs, rendered from a raw
 * markdown string. The heading is a solid `Slab`, the canonical section head on
 * the about/back pages. `[label](href)` links are interpreted; no other inline
 * markdown is.
 *
 * The prose is NOT held here: it lives in a repo-root document
 * (`ABOUT_JRVS.md`, `LLM_STATEMENT.md`) and is passed in raw, so the two sites
 * cannot drift apart and the wording can be edited without touching component
 * code. This mirrors `Changelog`, the other shared markdown-backed surface —
 * the library stays data-source agnostic, and each app reads the file the way
 * its build allows (srd via `node:fs`, ITUN via a Vite `?raw` import).
 */
export function MarkdownSection({ markdown, className }: MarkdownSectionProps) {
  const { heading, paragraphs } = parseMarkdownSection(markdown)

  return (
    <section className={cn('flex flex-col gap-3 text-sm leading-relaxed', className)}>
      {heading && <Slab as="h2" variant="solid" label={heading} className="mb-0" />}
      {paragraphs.map((paragraph) => (
        <p key={paragraph}>
          {/* Keyed by running offset: two runs in one paragraph can hold the
              same text, and `key={node.text}` would collide on those. */}
          {withOffsets(parseInline(paragraph)).map(({ node, offset }) =>
            node.href ? (
              <a
                key={`${offset}-${node.text}`}
                href={node.href}
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold text-rust hover:underline"
              >
                {node.text}
              </a>
            ) : (
              <Fragment key={`${offset}-${node.text}`}>{node.text}</Fragment>
            )
          )}
        </p>
      ))}
    </section>
  )
}
