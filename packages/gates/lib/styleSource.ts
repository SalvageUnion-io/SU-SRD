/**
 * Style sources read for their context, for `rules/chromeTokens.ts`: a
 * stylesheet as its declarations and blocks (`parseCss`), and a script with its
 * comments blanked, read as offsets and the object literal around one.
 */

/** One declaration of a stylesheet, with the blocks it sits in. */
export type CssDecl = {
  line: number
  /** Lower-cased property name. */
  prop: string
  value: string
  /** The headers of every enclosing block, outermost first (selectors and at-rule preludes). */
  context: readonly string[]
  /** Every declaration of the same block, this one included. */
  siblings: readonly CssDecl[]
}

/** One block header: a selector list or an at-rule prelude. */
export type CssBlock = { line: number; header: string; context: readonly string[] }

/** Comments blanked to spaces, newlines kept, so offsets and lines still agree. */
function blankComments(text: string): string {
  return text.replace(/\/\*[\s\S]*?\*\//g, (c) => c.replace(/[^\n]/g, ' '))
}

/**
 * A stylesheet's declarations and block headers. Not a CSS parser: enough of
 * one for the files this repo writes (nesting, at-rules, quoted strings).
 */
export function parseCss(text: string): { decls: CssDecl[]; blocks: CssBlock[] } {
  const src = blankComments(text)
  const decls: CssDecl[] = []
  const blocks: CssBlock[] = []
  const stack: { header: string; decls: CssDecl[] }[] = [{ header: '', decls: [] }]
  let buf = ''
  let bufLine = 0
  let line = 1
  const context = () => stack.slice(1).map((b) => b.header)
  const flush = () => {
    const t = buf.trim()
    buf = ''
    if (!t || t.startsWith('@')) return
    const colon = t.indexOf(':')
    if (colon < 0) return
    const top = stack[stack.length - 1]
    if (!top) return
    const decl: CssDecl = {
      line: bufLine,
      prop: t.slice(0, colon).trim().toLowerCase(),
      value: t
        .slice(colon + 1)
        .trim()
        .replace(/\s+/g, ' '),
      context: context(),
      siblings: top.decls,
    }
    top.decls.push(decl)
    decls.push(decl)
  }
  for (let i = 0; i < src.length; i++) {
    const ch = src[i] as string
    if (ch === '\n') line++
    if (!buf.trim() && !/\s/.test(ch)) bufLine = line
    if (ch === '"' || ch === "'") {
      let j = i + 1
      while (j < src.length && src[j] !== ch) {
        if (src[j] === '\\') j++
        else if (src[j] === '\n') line++
        j++
      }
      buf += src.slice(i, j + 1)
      i = j
      continue
    }
    if (ch === '{') {
      const header = buf.trim().replace(/\s+/g, ' ')
      blocks.push({ line: bufLine, header, context: context() })
      stack.push({ header, decls: [] })
      buf = ''
      continue
    }
    if (ch === ';') {
      flush()
      continue
    }
    if (ch === '}') {
      flush()
      if (stack.length > 1) stack.pop()
      continue
    }
    buf += ch
  }
  return { decls, blocks }
}

/**
 * A script with its comments blanked (`//` to the end of the line, and block
 * comments), offsets and lines kept. A `//` inside a string (a URL) is left.
 */
export function blankScriptComments(text: string): string {
  let out = ''
  let i = 0
  while (i < text.length) {
    const ch = text[i] as string
    const next = text[i + 1]
    if (ch === '"' || ch === "'" || ch === '`') {
      let j = i + 1
      while (j < text.length && text[j] !== ch && !(ch !== '`' && text[j] === '\n')) {
        if (text[j] === '\\') j++
        j++
      }
      out += text.slice(i, j + 1)
      i = j + 1
      continue
    }
    if (ch === '/' && next === '/') {
      const end = text.indexOf('\n', i)
      const stop = end < 0 ? text.length : end
      out += ' '.repeat(stop - i)
      i = stop
      continue
    }
    if (ch === '/' && next === '*') {
      const end = text.indexOf('*/', i + 2)
      const stop = end < 0 ? text.length : end + 2
      out += text.slice(i, stop).replace(/[^\n]/g, ' ')
      i = stop
      continue
    }
    out += ch
    i++
  }
  return out
}

/** The 1-based line of an offset. */
export function lineAt(text: string, offset: number): number {
  let n = 1
  for (let i = 0; i < offset && i < text.length; i++) if (text[i] === '\n') n++
  return n
}

/**
 * The text of the object literal (or block) around `offset`: from its `{` to
 * its `}`. Braces inside strings are rare enough in style objects to ignore.
 */
export function enclosingObject(text: string, offset: number): string {
  let start = 0
  for (let i = offset, depth = 0; i >= 0; i--) {
    if (text[i] === '}') depth++
    else if (text[i] === '{') {
      if (depth === 0) {
        start = i
        break
      }
      depth--
    }
  }
  let end = text.length
  for (let i = offset, depth = 0; i < text.length; i++) {
    if (text[i] === '{') depth++
    else if (text[i] === '}') {
      if (depth === 0) {
        end = i + 1
        break
      }
      depth--
    }
  }
  return text.slice(start, end)
}

/** Every match of a global pattern in a script, as offsets. */
export function matchesIn(
  text: string,
  pattern: RegExp,
  keep: (m: RegExpExecArray) => boolean = () => true
): { offset: number; detail: string }[] {
  const out: { offset: number; detail: string }[] = []
  for (const m of text.matchAll(pattern)) {
    if (keep(m)) out.push({ offset: m.index ?? 0, detail: m[0].trim() })
  }
  return out
}
