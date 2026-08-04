import { Fragment } from 'react'
import type { InlineNode } from './parseMarkdownSection'
import { parseInline } from './parseMarkdownSection'

/** Pair each run with its start offset in the text — a stable React key. */
function withOffsets(nodes: InlineNode[]): Array<{ node: InlineNode; offset: number }> {
  let offset = 0
  return nodes.map((node) => {
    const at = offset
    offset += node.text.length
    return { node, offset: at }
  })
}

type InlineMarkdownProps = {
  /** A single line of prose; `[label](href)` links are interpreted. */
  text: string
}

/** The one link look both markdown surfaces render. */
const LINK_CLASS = 'font-semibold text-rust hover:underline'

/**
 * The inline half of the shared markdown contract: split `text` into plain runs
 * and `[label](href)` links (via {@link parseInline}) and render each, links as
 * new-tab anchors. Bold, italics and lists stay literal — the one inline form
 * both markdown surfaces interpret is links.
 *
 * Shared by {@link MarkdownSection} (repo-root prose) and `Changelog` (release
 * notes) so an issue/commit reference like `([#518](…))` renders as a link on
 * both, from one rendering path rather than two hand-kept copies.
 */
export function InlineMarkdown({ text }: InlineMarkdownProps) {
  return (
    <>
      {/* Keyed by running offset: two runs in one line can hold the same text,
          and `key={node.text}` would collide on those. */}
      {withOffsets(parseInline(text)).map(({ node, offset }) =>
        node.href ? (
          <a
            key={`${offset}-${node.text}`}
            href={node.href}
            target="_blank"
            rel="noopener noreferrer"
            className={LINK_CLASS}
          >
            {node.text}
          </a>
        ) : (
          <Fragment key={`${offset}-${node.text}`}>{node.text}</Fragment>
        )
      )}
    </>
  )
}
