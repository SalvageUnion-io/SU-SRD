export type LlmStatementContent = {
  /** The `#` heading, used as the section head on both about pages. */
  heading: string
  /** Blank-line-separated blocks, each rendered as one `<p>`. */
  paragraphs: string[]
}

/**
 * Parse the repo-root `LLM_STATEMENT.md` into its heading + paragraphs.
 *
 * Deliberately minimal, like `parseChangelog`: the statement is prose we
 * control, so it has a fixed shape (one `#` heading, then plain paragraphs) and
 * needs no markdown library. Inline markdown is NOT interpreted — that contract
 * is stated in the source file's own header comment, so a link added there
 * would render as literal text rather than silently breaking.
 */
export function parseLlmStatement(markdown: string): LlmStatementContent {
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
