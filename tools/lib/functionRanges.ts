/**
 * Every function in a source file as a 1-based line range, for `mergeLcov`
 * (`lib/lcov.ts`), which needs to know which function a reported line sits in.
 */

import { readFileSync } from 'node:fs'
import { parseSync } from 'oxc-parser'
import type { FunctionRange } from './lcov'

const FUNCTION_TYPES = new Set([
  'FunctionDeclaration',
  'FunctionExpression',
  'ArrowFunctionExpression',
])

/** The line ranges of every function in the file at `path`. */
export function functionRanges(path: string): FunctionRange[] {
  const source = readFileSync(path, 'utf-8')
  const lineStarts = [0]
  for (let i = 0; i < source.length; i++) if (source[i] === '\n') lineStarts.push(i + 1)
  const lineOf = (offset: number) => {
    let lo = 0
    let hi = lineStarts.length - 1
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1
      if ((lineStarts[mid] ?? 0) <= offset) lo = mid
      else hi = mid - 1
    }
    return lo + 1
  }
  const ranges: FunctionRange[] = []
  const visit = (value: unknown): void => {
    if (Array.isArray(value)) {
      for (const item of value) visit(item)
      return
    }
    if (value === null || typeof value !== 'object') return
    const node = value as { type?: unknown; start?: unknown; end?: unknown }
    if (
      typeof node.type === 'string' &&
      FUNCTION_TYPES.has(node.type) &&
      typeof node.start === 'number' &&
      typeof node.end === 'number'
    ) {
      ranges.push([lineOf(node.start), lineOf(node.end)])
    }
    for (const [key, child] of Object.entries(value)) if (key !== 'parent') visit(child)
  }
  visit(parseSync(path, source).program)
  return ranges
}
