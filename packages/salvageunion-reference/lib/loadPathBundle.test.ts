/**
 * The runtime graph never reaches Zod or the entity schemas (audit PK-04).
 *
 * `preload()` installs the committed data without parsing it, so neither Zod nor
 * `lib/generated/zodSchemaMap.generated.ts` belongs in an app bundle. A single
 * import of that module, of `lib/zod.ts`, or a value import from `lib/schemas/`
 * anywhere in the runtime graph — static or dynamic — silently undoes that, and
 * nothing else would notice: the app still works, it is just ~0.5 MB heavier.
 *
 * So this bundles the package's two runtime entries the way an app would
 * (browser target, code splitting) and asserts that no emitted chunk, eager or
 * lazy, contains a module from Zod or `lib/schemas/`.
 */
import { expect, test } from 'bun:test'
import { join } from 'node:path'

const libDir = import.meta.dir

// Bun's unminified output heads each inlined module with a `// <path>` comment.
const ZOD_MODULE = /^\/\/ .*node_modules\/.*zod@/m
const SCHEMA_MODULE = /^\/\/ lib\/(schemas\/|zod\.ts|generated\/zodSchemaMap)/m

test('no chunk of the runtime bundle contains Zod or the entity schemas', async () => {
  const result = await Bun.build({
    entrypoints: [join(libDir, 'index.ts'), join(libDir, 'rules', 'index.ts')],
    target: 'browser',
    splitting: true,
    minify: false,
  })
  if (!result.success) throw new Error(`bundle failed:\n${result.logs.join('\n')}`)
  expect(result.outputs.filter((o) => o.kind === 'entry-point')).toHaveLength(2)

  for (const output of result.outputs) {
    const text = await output.text()
    expect(ZOD_MODULE.test(text), `${output.path} contains Zod`).toBe(false)
    expect(SCHEMA_MODULE.test(text), `${output.path} contains the entity schemas`).toBe(false)
  }
})
