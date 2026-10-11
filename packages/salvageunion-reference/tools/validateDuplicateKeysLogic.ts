/**
 * Pure logic for two duplication checks: an object in a data file that
 * spells the same key twice, and an `additionalSources` entry that repeats
 * its own row's citation.
 *
 * `JSON.parse` keeps the LAST value and says nothing, so every consumer and
 * every other check reads that one, and the text above it is dead. A chassis
 * re-cited to a new page while its old `"page"` stayed further down the object
 * read the old page everywhere. This reads the raw text, which is the only
 * place the duplicate is visible.
 */

import { visit } from 'jsonc-parser'

type DuplicateKey = {
  /** JSON path of the object holding the duplicate, e.g. `[29]` or `[3].patterns[0]`. */
  path: string
  key: string
  /** 1-based line of each occurrence. */
  lines: number[]
}

function pathString(segments: Array<string | number>): string {
  return segments.map((s) => (typeof s === 'number' ? `[${s}]` : `.${s}`)).join('')
}

/** Every key spelled more than once in the same object, at any depth of `text`. */
export function findDuplicateKeys(text: string): DuplicateKey[] {
  const found: DuplicateKey[] = []
  const stack: Array<{ path: string; seen: Map<string, number[]> }> = []
  visit(text, {
    onObjectBegin: (_offset, _length, _line, _col, pathSupplier) => {
      stack.push({ path: pathString(pathSupplier()), seen: new Map() })
    },
    onObjectProperty: (property, _offset, _length, startLine) => {
      const top = stack[stack.length - 1]
      if (!top) return
      const lines = top.seen.get(property) ?? []
      lines.push(startLine + 1)
      top.seen.set(property, lines)
    },
    onObjectEnd: () => {
      const top = stack.pop()
      if (!top) return
      for (const [key, lines] of top.seen) {
        if (lines.length > 1) found.push({ path: top.path, key, lines })
      }
    },
  })
  return found
}

type Citation = { source?: unknown; booklet?: unknown; page?: unknown }

const sameCitation = (a: Citation, b: Citation) =>
  a.source === b.source && a.booklet === b.booklet && a.page === b.page

/**
 * Every `additionalSources` entry, at any depth of a row (rows and patterns
 * both cite), that repeats the citation of the object it sits on. A row
 * re-cited to a reprint keeps the reprint as a second source by accident;
 * it adds nothing and reads as two printings.
 */
export function findSelfCitations(
  filesByName: Record<string, unknown[]>
): Array<{ file: string; path: string; source: string }> {
  const found: Array<{ file: string; path: string; source: string }> = []
  const walk = (node: unknown, file: string, path: string): void => {
    if (Array.isArray(node)) {
      for (const [i, child] of node.entries()) walk(child, file, `${path}[${i}]`)
      return
    }
    if (node === null || typeof node !== 'object') return
    const obj = node as Citation & { additionalSources?: unknown; name?: unknown }
    if (typeof obj.source === 'string' && Array.isArray(obj.additionalSources)) {
      for (const [i, extra] of (obj.additionalSources as Citation[]).entries()) {
        if (sameCitation(obj, extra)) {
          found.push({ file, path: `${path}.additionalSources[${i}]`, source: obj.source })
        }
      }
    }
    for (const [key, child] of Object.entries(obj)) walk(child, file, `${path}.${key}`)
  }
  for (const [file, rows] of Object.entries(filesByName)) walk(rows, file, '')
  return found
}
