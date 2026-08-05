/**
 * formatWithBiome — format generated source through the repo's Biome binary.
 *
 * This replaces the `prettier.format(...)` calls the generators used to make.
 * Prettier is gone from the repo (Biome is the single formatter), but the
 * generators still need to format *in-process*, before writing, because their
 * output is committed and gated by `check:schemas` (a `git diff --exit-code`).
 * Emitting unformatted source and letting a later `biome format --write` pass
 * fix it would make that gate fail on a clean tree.
 *
 * ## Why shell out instead of using a Biome API package
 *
 * `@biomejs/js-api` would be a second copy of Biome (it needs its own wasm
 * backend) resolved independently of the pinned `@biomejs/biome` devDependency,
 * so the two could format differently after a version bump — exactly the drift
 * this file exists to prevent. Driving the pinned binary guarantees generated
 * output matches what `bun run format` and CI's `format:check` produce.
 *
 * ## The ignored-path gotcha
 *
 * Biome derives the language from `--stdin-file-path`, but it ALSO applies
 * `files.includes` to it: hand it a path the config ignores and it returns the
 * input untouched, with no error and exit code 0. `lib/generated/` is one of
 * those ignored paths (biome.jsonc), so passing a real generated file's path
 * would silently no-op. Callers therefore pass a *synthetic* path that shares
 * the extension but sits outside the ignore list — see `TS_FORMAT_PATH`.
 */

import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const packageDir = dirname(dirname(fileURLToPath(import.meta.url)))

/**
 * Locate the Biome binary by walking up from this package until a
 * `node_modules/.bin/biome` appears. Mirrors `generateApiReport.ts`'s
 * `findTsc()` so both generators resolve their toolchain the same way, and
 * keeps this working from a bare workspace as well as the hoisted root.
 */
function findBiome(): string {
  let dir = packageDir
  while (true) {
    const candidate = join(dir, 'node_modules', '.bin', 'biome')
    if (existsSync(candidate)) return candidate
    const parent = dirname(dir)
    if (parent === dir) break
    dir = parent
  }
  throw new Error(`Could not locate node_modules/.bin/biome walking up from ${packageDir}`)
}

const biome = findBiome()

/**
 * A `.ts` path inside the package that Biome is configured to format. Used as
 * the synthetic `--stdin-file-path` for `lib/generated/**` output, which Biome
 * ignores on disk (see the header note). The file need not exist — only its
 * extension and its position relative to `files.includes` are read.
 */
export const TS_FORMAT_PATH = join(packageDir, 'lib', '__generated-format__.ts')

/**
 * Format `source` as the language implied by `filePath`, using the repo's Biome
 * config. Throws on a Biome failure rather than returning unformatted source —
 * a silent pass-through here would land malformed generated code in a commit.
 */
export function formatWithBiome(source: string, filePath: string): string {
  const result = spawnSync(biome, ['format', `--stdin-file-path=${filePath}`], {
    input: source,
    encoding: 'utf-8',
    // Biome walks up from cwd for biome.jsonc; the package dir reaches the root
    // config regardless of where the generator was invoked from.
    cwd: packageDir,
    maxBuffer: 64 * 1024 * 1024,
  })

  if (result.error) {
    throw new Error(`biome format failed for ${filePath}: ${result.error.message}`)
  }
  if (result.status !== 0) {
    throw new Error(
      `biome format exited ${result.status} for ${filePath}:\n${result.stderr || result.stdout}`
    )
  }

  // Biome prints a diagnostic to stdout (not stderr) and still exits 0 when the
  // path is ignored, which would corrupt the file with a human-readable notice.
  // Detect that explicitly rather than trusting the exit code.
  if (result.stdout.includes('The content was not formatted because the path')) {
    throw new Error(
      `biome ignores ${filePath}, so it was returned unformatted. Pass a synthetic ` +
        "path outside biome.jsonc's ignore list (see TS_FORMAT_PATH)."
    )
  }

  return result.stdout
}
