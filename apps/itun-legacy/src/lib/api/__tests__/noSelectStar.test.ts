import { describe, test, expect } from 'bun:test'
import { readFileSync, readdirSync } from 'fs'
import { join } from 'path'

/**
 * Enforces that no Supabase queries use .select('*'), which selects all columns
 * and prevents TypeScript from inferring narrowed return types. Each query should
 * select only the columns it actually uses.
 */

const API_DIR = join(import.meta.dir, '..')

function getApiFiles(): string[] {
  return readdirSync(API_DIR)
    .filter((f) => f.endsWith('.ts') && !f.endsWith('.test.ts'))
    .map((f) => join(API_DIR, f))
}

describe('Supabase query hygiene', () => {
  test('no API file uses .select("*")', () => {
    const violations: string[] = []

    for (const filePath of getApiFiles()) {
      const content = readFileSync(filePath, 'utf-8')
      const fileName = filePath.split('/').pop()!

      // Match .select('*') and .select("*")
      const matches = content.match(/\.select\(['"]?\*['"]?\)/g)
      if (matches) {
        violations.push(`${fileName}: found ${matches.length} instance(s) of .select('*')`)
      }
    }

    if (violations.length > 0) {
      throw new Error(
        `Found .select('*') usage in API files:\n${violations.map((v) => `  - ${v}`).join('\n')}\n\nReplace with explicit column lists.`
      )
    }

    expect(violations).toHaveLength(0)
  })

  test('no API file uses bare .select() on read queries (only on write-then-read chains)', () => {
    const violations: string[] = []

    for (const filePath of getApiFiles()) {
      const content = readFileSync(filePath, 'utf-8')
      const fileName = filePath.split('/').pop()!

      // Find bare .select() that are NOT preceded by insert/update/upsert on the same chain.
      // We look for patterns like .from(...).select() which are read-only queries.
      const lines = content.split('\n')
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i] ?? ''
        // Bare .select() on its own line — check context
        if (/\.select\(\)$/.test(line.trim())) {
          // Look back up to 10 lines to see if there's an insert/update/upsert
          const context = lines.slice(Math.max(0, i - 10), i + 1).join('\n')
          const isWriteChain = /\.(insert|update|upsert)\(/.test(context) || /\.rpc\(/.test(context)
          if (!isWriteChain) {
            violations.push(
              `${fileName}:${i + 1}: bare .select() on what appears to be a read query`
            )
          }
        }
      }
    }

    if (violations.length > 0) {
      throw new Error(
        `Found bare .select() on read queries in API files:\n${violations.map((v) => `  - ${v}`).join('\n')}\n\nReplace with explicit column lists.`
      )
    }

    expect(violations).toHaveLength(0)
  })
})
