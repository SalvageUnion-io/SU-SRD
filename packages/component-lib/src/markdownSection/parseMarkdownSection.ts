export type MarkdownSectionContent = {
  /** The `#` heading, used as the section head. */
  heading: string
  /** Blank-line-separated blocks, each rendered as one `<p>`. */
  paragraphs: string[]
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
  const withoutComments = markdown.replace(/<!--[\s\S]*?-->/g, '')

  const blocks = withoutComments
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
