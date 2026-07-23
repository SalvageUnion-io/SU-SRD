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

/** A run of paragraph text; `href` set means render it as a link. */
export type InlineNode = {
  text: string
  href?: string
}

/**
 * Only absolute http(s) and site-relative targets become links.
 *
 * These documents are repo-controlled, so this is not a trust boundary — it is
 * a guard against a typo or a paste producing a `javascript:` href that renders
 * as a live link.
 */
function isLinkableHref(href: string): boolean {
  return href.startsWith('https://') || href.startsWith('http://') || href.startsWith('/')
}

/**
 * Split a paragraph into text runs and `[label](href)` links.
 *
 * Links are the one piece of inline markdown these documents interpret; bold,
 * italics and lists still render as literal punctuation, which is what the
 * format contract in each file's header says. Scanned with `indexOf` rather
 * than a pattern, for the same reason the rest of this file is regex-free.
 * Anything that doesn't parse as a link is emitted as plain text, so a stray
 * bracket is shown, not swallowed.
 */
export function parseInline(text: string): InlineNode[] {
  const nodes: InlineNode[] = []
  let rest = text

  while (rest.length > 0) {
    const open = rest.indexOf('[')
    const close = open === -1 ? -1 : rest.indexOf('](', open)
    const end = close === -1 ? -1 : rest.indexOf(')', close + 2)
    if (open === -1 || close === -1 || end === -1) break

    const label = rest.slice(open + 1, close)
    const href = rest.slice(close + 2, end)

    if (label.includes('[') || !isLinkableHref(href)) {
      // Not a usable link: keep the bracket as text and scan past it.
      nodes.push({ text: rest.slice(0, open + 1) })
      rest = rest.slice(open + 1)
      continue
    }

    if (open > 0) nodes.push({ text: rest.slice(0, open) })
    nodes.push({ text: label, href })
    rest = rest.slice(end + 1)
  }

  if (rest.length > 0) nodes.push({ text: rest })

  return nodes
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
