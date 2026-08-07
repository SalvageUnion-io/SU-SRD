/**
 * One blank-line-separated block: a paragraph, or a `- ` bullet list.
 *
 * A block becomes a list only when EVERY line in it is an item, so a block
 * mixing prose and dashes stays a paragraph and renders exactly as it did
 * before lists existed.
 */
export type MarkdownBlock = { kind: 'paragraph'; text: string } | { kind: 'list'; items: string[] }

export type MarkdownSectionContent = {
  /** The `#` heading, used as the section head. */
  heading: string
  /** Blank-line-separated blocks, in document order. */
  blocks: MarkdownBlock[]
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

/**
 * The items of a `- ` bullet block, or null if this block isn't one.
 *
 * All-or-nothing by design: one non-item line and the whole block stays prose.
 * That keeps the change additive — every document written before lists existed
 * parses to exactly the blocks it did before — and it means a stray hyphen at
 * the start of a wrapped line can't silently eat the paragraph around it.
 * Prefix checks only, so this stays regex-free like the rest of this file.
 */
function listItemsOf(block: string[]): string[] | null {
  const items: string[] = []

  for (const line of block) {
    if (!line.startsWith('- ')) return null
    const item = line.slice(2).trim()
    if (!item) return null
    items.push(item)
  }

  return items.length > 0 ? items : null
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
 * `LLM_STATEMENT.md`, `SPECIAL_THANKS.md`) into its heading + blocks.
 *
 * Deliberately minimal, like `parseChangelog`: these are short documents we
 * control, so they have a fixed shape and need no markdown library.
 *
 * This splits blocks only — paragraphs, plus `- ` bullet lists (added for
 * `SPECIAL_THANKS.md`'s crew credits, which are a list in substance and read
 * as one). Inline markdown is `parseInline`'s job, and `[label](href)` links
 * are the ONE inline form it interprets — the contract stated in each source
 * file's own header comment. Bold and italics still render as literal
 * punctuation rather than silently breaking.
 */
export function parseMarkdownSection(markdown: string): MarkdownSectionContent {
  let heading = ''
  const blocks: MarkdownBlock[] = []

  for (const block of blocksOf(dropCommentLines(markdown))) {
    if (!heading) {
      const candidate = headingOf(block)
      if (candidate !== null) {
        heading = candidate
        continue
      }
    }

    const items = listItemsOf(block)
    if (items) {
      blocks.push({ kind: 'list', items })
      continue
    }

    // Soft-wrapped prose joins into a single paragraph, matching markdown.
    blocks.push({ kind: 'paragraph', text: block.join(' ') })
  }

  return { heading, blocks }
}
