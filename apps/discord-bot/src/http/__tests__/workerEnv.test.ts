import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * The Worker's module graph must not reach `config.ts`.
 *
 * ## Why
 *
 * `config.ts` (the `deploy-commands` CLI's settings) calls
 * `requireEnv('DISCORD_TOKEN')` at MODULE SCOPE. That is fatal on Cloudflare:
 * if a command module reachable from the Worker imported it, the isolate would
 * evaluate `requireEnv` at startup. There is no `process.env` on workerd — configuration arrives as the
 * `env` argument to `fetch` — so the isolate would throw before serving
 * anything.
 *
 * **Behavioural tests cannot catch it.** `test/env.ts` is preloaded via
 * `bunfig.toml` and sets those variables, so `config.ts` loads happily under
 * Bun. The preload is exactly the thing that hides the defect.
 *
 * So this asserts the structural property directly: the transitive imports of
 * `http/worker.ts` never include `config.ts`. A future edit that reintroduces
 * the import fails here rather than at the first real interaction.
 */

const BOT_ROOT = join(import.meta.dir, '..', '..', '..')
const SRC = join(BOT_ROOT, 'src')

/** Resolve a relative import specifier to a file under `src/`. */
function resolveSpecifier(fromFile: string, specifier: string): string | null {
  if (!specifier.startsWith('.')) return null
  const base = join(fromFile, '..', specifier).replace(/\.js$/, '')
  for (const candidate of [`${base}.ts`, join(base, 'index.ts')]) {
    try {
      readFileSync(candidate, 'utf-8')
      return candidate
    } catch {
      // try the next shape
    }
  }
  return null
}

/** Every first-party module reachable from `entry`, following relative imports. */
function transitiveLocalImports(entry: string): Set<string> {
  const seen = new Set<string>()
  const queue = [entry]

  while (queue.length > 0) {
    const file = queue.pop()
    if (!file || seen.has(file)) continue
    seen.add(file)

    const source = readFileSync(file, 'utf-8')
    // Value and type imports alike. A type-only import of `config` would be
    // harmless at runtime, but this repo has no such import and allowing one
    // would make the rule ambiguous to the next reader.
    for (const match of source.matchAll(/from\s+'([^']+)'/g)) {
      const resolved = resolveSpecifier(file, match[1] ?? '')
      if (resolved) queue.push(resolved)
    }
  }

  return seen
}

describe('Worker module graph', () => {
  const graph = transitiveLocalImports(join(SRC, 'http', 'worker.ts'))

  test('never reaches config.ts, which reads process.env at module scope', () => {
    const configPath = join(SRC, 'config.ts')
    const reachesConfig = graph.has(configPath)

    expect(reachesConfig).toBe(false)
  })

  test('the graph is actually being walked (guards against a vacuous pass)', () => {
    // If `resolveSpecifier` ever silently stopped resolving, the assertion
    // above would pass for the wrong reason. Anchor on modules that MUST be
    // present.
    expect(graph.has(join(SRC, 'http', 'worker.ts'))).toBe(true)
    expect(graph.has(join(SRC, 'commands', 'index.ts'))).toBe(true)
    expect(graph.has(join(SRC, 'buttons.ts'))).toBe(true)
    expect(graph.size).toBeGreaterThan(10)
  })
})
