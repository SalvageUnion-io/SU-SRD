export type MarkdownSectionContent = {
  /** The `#` heading, used as the section head. */
  heading: string
  /** Blank-line-separated blocks, each rendered as one `<p>`. */
  paragraphs: string[]
}

/**
 * Drop the leading HTML comment block, line by line.
 *
 * A line scan rather than a `<!--[\s\S]*?-->` replace, which CodeQL flags twice
 * over — as polynomial ReDoS (input starting with many unterminated `<!--`),
 * and as incomplete multi-character sanitization (removing one `<!-- -->` span
 * can splice a fresh `<!--` back together out of the text either side of it).
 * Neither is reachable from a repo-controlled build-time file whose output is
 * rendered as React text, but the scan is linear and can't reintroduce the
 * sequence, so there is nothing to argue about. Whole lines go, which suits the
 * documented format: the comment is a block of its own.
 */
function dropCommentLines(markdown: string): string {
  const kept: string[] = []
  let inComment = false

  for (const line of markdown.split('\n')) {
    if (inComment) {
      if (line.includes('-->')) inComment = false
      continue
    }
    if (line.trimStart().startsWith('<!--')) {
      inComment = !line.includes('-->')
      continue
    }
    kept.push(line)
  }

  return kept.join('\n')
}

/**
 * Parse one of the repo-root prose documents (`ABOUT_JRVS.md`,
 * `LLM_STATEMENT.md`) into its heading + paragraphs.
 *
 * Deliberately minimal, like `parseChangelog`: these are short documents we
 * control, so they have a fixed shape (one `#` heading, then plain paragraphs)
 * and need no markdown library. Inline markdown is NOT interpreted — that
 * contract is stated in each source file's own header comment, so a link added
 * to one would render as literal text rather than silently breaking.
 */
export function parseMarkdownSection(markdown: string): MarkdownSectionContent {
  const blocks = dropCommentLines(markdown)
    .split(/\n\s*\n/)
    .map((block) => block.trim())
    .filter(Boolean)

  let heading = ''
  const paragraphs: string[] = []

  for (const block of blocks) {
    const headingMatch = block.match(/^#\s+(.*)$/)
    if (headingMatch?.[1] && !heading) {
      heading = headingMatch[1].trim()
      continue
    }
    // Soft-wrapped prose joins into a single paragraph, matching markdown.
    paragraphs.push(block.replace(/\s*\n\s*/g, ' '))
  }

  return { heading, paragraphs }
}
