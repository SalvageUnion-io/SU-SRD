export type MarkdownSectionContent = {
  /** The `#` heading, used as the section head. */
  heading: string
  /** Blank-line-separated blocks, each rendered as one `<p>`. */
  paragraphs: string[]
}

/**
 * This parser is deliberately regex-free.
 *
 * Every pattern it started with drew a `js/polynomial-redos` alert from
 * CodeQL — `<!--[\s\S]*?-->`, `^#\s+(.*)$`, `\s*\n\s*`, `\n\s*\n` — because
 * each mixes an unbounded whitespace class with an adjacent one and so can
 * backtrack on pathological input. Fixing them one at a time just surfaced the
 * next, and none of these documents is worth a regex: the format is one `#`
 * heading and blank-line-separated plain paragraphs, which line and prefix
 * operations express directly, in linear time, with nothing to backtrack.
 */

/**
 * Drop HTML comment blocks, line by line.
 *
 * Whole lines go, which suits the documented format: the comment header is a
 * block of its own. Because nothing is cut out of the middle of a line, this
 * also can't splice a fresh `<!--` together from the text either side of a
 * removed span — the second thing CodeQL flagged about the original replace.
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

/** Blank-line-separated blocks, each as its list of trimmed lines. */
function blocksOf(text: string): string[][] {
  const blocks: string[][] = []
  let current: string[] = []

  for (const raw of text.split('\n')) {
    const line = raw.trim()
    if (line) {
      current.push(line)
    } else if (current.length > 0) {
      blocks.push(current)
      current = []
    }
  }
  if (current.length > 0) blocks.push(current)

  return blocks
}

/** The heading text of a `# …` block, or null if this block isn't one. */
function headingOf(block: string[]): string | null {
  if (block.length !== 1) return null

  const line = block[0] ?? ''
  if (!line.startsWith('#')) return null

  // `#` must be followed by whitespace, so `#hashtag` stays prose.
  const rest = line.slice(1)
  if (rest === rest.trimStart()) return null

  return rest.trim()
}

/**
 * Parse one of the repo-root prose documents (`ABOUT_JRVS.md`,
 * `LLM_STATEMENT.md`) into its heading + paragraphs.
 *
 * Deliberately minimal, like `parseChangelog`: these are short documents we
 * control, so they have a fixed shape and need no markdown library. Inline
 * markdown is NOT interpreted — that contract is stated in each source file's
 * own header comment, so a link added to one would render as literal text
 * rather than silently breaking.
 */
export function parseMarkdownSection(markdown: string): MarkdownSectionContent {
  let heading = ''
  const paragraphs: string[] = []

  for (const block of blocksOf(dropCommentLines(markdown))) {
    if (!heading) {
      const candidate = headingOf(block)
      if (candidate !== null) {
        heading = candidate
        continue
      }
    }
    // Soft-wrapped prose joins into a single paragraph, matching markdown.
    paragraphs.push(block.join(' '))
  }

  return { heading, paragraphs }
}
