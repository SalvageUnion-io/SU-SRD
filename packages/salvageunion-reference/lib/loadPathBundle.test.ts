/**
 * The trusted load path keeps Zod out of the static bundle graph (audit PK-04).
 *
 * `preload()` only reaches the entity schemas through a dynamic `import()` of
 * `lib/validateData.ts` (which imports `lib/generated/zodSchemaMap.generated.ts`
 * statically), so a bundler can leave Zod and
 * every schema out of the chunks a trusted load needs. A single static import
 * of that module — or of `lib/zod.ts`, or a value import from `lib/schemas/` —
 * anywhere in the runtime graph silently undoes that, and nothing else would
 * notice: the app still works, it is just ~0.5 MB heavier again.
 *
 * So this bundles the package's two runtime entries the way an app would
 * (browser target, code splitting), walks the STATIC import closure of each
 * entry, and asserts no module from Zod or `lib/schemas/` is in it. The lazy
 * chunk must still exist — that is what `{ validate: true }` loads.
 */
import { describe, expect, test } from 'bun:test'
import { join, posix } from 'node:path'

const libDir = import.meta.dir

async function bundle() {
  const result = await Bun.build({
    entrypoints: [join(libDir, 'index.ts'), join(libDir, 'rules', 'index.ts')],
    target: 'browser',
    splitting: true,
    minify: false,
  })
  if (!result.success) throw new Error(`bundle failed:\n${result.logs.join('\n')}`)
  const byName = new Map<string, string>()
  const entries: string[] = []
  for (const output of result.outputs) {
    const name = posix.normalize(output.path)
    byName.set(name, await output.text())
    if (output.kind === 'entry-point') entries.push(name)
  }
  return { byName, entries }
}

/** Every chunk reachable from `entry` through static `import … from` edges. */
function staticClosure(entry: string, byName: Map<string, string>): Set<string> {
  const seen = new Set<string>()
  const queue = [entry]
  while (queue.length > 0) {
    const name = queue.pop() as string
    if (seen.has(name)) continue
    seen.add(name)
    const text = byName.get(name) ?? ''
    // `import {…} from "./x.js"`, `export {…} from "../x.js"`, `import "./x.js"`
    // — never `import("./x.js")`, which is the lazy edge this test permits.
    for (const m of text.matchAll(
      /(?:^|\n)\s*(?:(?:import|export)\s[^;(]*?from\s*|import\s*)"(\.\.?\/[^"]+)"/g
    )) {
      if (m[1]) queue.push(posix.join(posix.dirname(name), m[1]))
    }
  }
  return seen
}

// Bun's unminified output heads each inlined module with a `// <path>` comment.
const ZOD_MODULE = /^\/\/ .*node_modules\/.*zod@/m
const SCHEMA_MODULE = /^\/\/ lib\/(schemas\/|zod\.ts|validateData\.ts|generated\/zodSchemaMap)/m

describe('trusted load path bundle graph', () => {
  test('no entry statically reaches Zod or the entity schemas', async () => {
    const { byName, entries } = await bundle()
    expect(entries.length).toBe(2)

    for (const entry of entries) {
      for (const chunk of staticClosure(entry, byName)) {
        const text = byName.get(chunk) ?? ''
        expect(ZOD_MODULE.test(text), `${entry} statically loads Zod via ${chunk}`).toBe(false)
        expect(SCHEMA_MODULE.test(text), `${entry} statically loads schemas via ${chunk}`).toBe(
          false
        )
      }
    }
  })

  test('the schemas still ship, in a chunk only a dynamic import reaches', async () => {
    const { byName, entries } = await bundle()
    const eager = new Set(entries.flatMap((entry) => [...staticClosure(entry, byName)]))
    const schemaChunks = [...byName.entries()]
      .filter(([, text]) => /^\/\/ lib\/generated\/zodSchemaMap\.generated\.ts/m.test(text))
      .map(([name]) => name)
    expect(schemaChunks.length).toBe(1)
    expect(eager.has(schemaChunks[0] as string)).toBe(false)
  })
})
