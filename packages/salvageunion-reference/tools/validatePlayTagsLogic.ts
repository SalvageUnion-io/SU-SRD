/**
 * Play tags: a content block's `notInPlay` names book text that a Play
 * surface leaves out of an action's row (R65). The tags are display-only, so
 * the one way they can go wrong is by drifting from the words they name: a
 * `text` that is no longer in the block's value, or is in it twice, or two
 * tags that overlap. Each would trim the wrong words at the table, silently.
 */

export type PlayTagIssue = {
  file: string
  record: string
  /** 0-based index of the content block. */
  block: number
  detail: string
}

type Tag = { role?: unknown; text?: unknown }

/** Every problem with one block's tags. */
export function findTagIssuesInBlock(block: Record<string, unknown>): string[] {
  const tags = block.notInPlay
  if (!Array.isArray(tags)) return []
  const value = block.value
  if (typeof value !== 'string') return ['tags a block whose value is not text']
  const issues: string[] = []
  const whole = (tags as Tag[]).filter((t) => t.text === undefined)
  if (whole.length > 0 && tags.length > 1) {
    issues.push('leaves out the whole block and also part of it; keep one tag')
  }
  const spans: [number, number][] = []
  for (const tag of tags as Tag[]) {
    if (typeof tag.text !== 'string') continue
    const at = value.indexOf(tag.text)
    if (at < 0) {
      issues.push(`"${tag.text.slice(0, 60)}" is not in the block's value`)
      continue
    }
    if (value.indexOf(tag.text, at + 1) >= 0) {
      issues.push(`"${tag.text.slice(0, 60)}" is in the block's value more than once`)
      continue
    }
    spans.push([at, at + tag.text.length])
  }
  spans.sort((a, b) => a[0] - b[0])
  for (let i = 1; i < spans.length; i++) {
    const [prev, next] = [spans[i - 1], spans[i]]
    if (prev && next && next[0] < prev[1]) issues.push('two tags overlap')
  }
  return issues
}

/** Every tag problem in the data bag (filename -> parsed records). */
export function runPlayTagCheck(
  filesByName: Record<string, Record<string, unknown>[]>
): PlayTagIssue[] {
  const out: PlayTagIssue[] = []
  for (const [file, records] of Object.entries(filesByName)) {
    for (const record of records) {
      const content = record.content
      if (!Array.isArray(content)) continue
      content.forEach((block, i) => {
        for (const detail of findTagIssuesInBlock(block as Record<string, unknown>)) {
          out.push({ file, record: String(record.name ?? '(unnamed)'), block: i, detail })
        }
      })
    }
  }
  return out
}
