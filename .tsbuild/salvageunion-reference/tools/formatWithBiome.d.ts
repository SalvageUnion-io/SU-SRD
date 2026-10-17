/**
 * formatWithBiome — format generated source through the repo's Biome binary.
 *
 * Biome is the single formatter, and the generators format *in-process*,
 * before writing: `lib/index.ts` is committed and gated by
 * `tools/check-generated.ts`, `biome ci .` reads the gitignored `schemas/`
 * too (Biome ignores `.gitignore`), and srd serves those bytes verbatim. A later `biome format --write` pass would leave a
 * clean tree failing that gate.
 *
 * ## Why shell out instead of using a Biome API package
 *
 * `@biomejs/js-api` would be a second copy of Biome (it needs its own wasm
 * backend) resolved independently of the pinned `@biomejs/biome` devDependency,
 * so the two could format differently after a version bump — exactly the drift
 * this file exists to prevent. Driving the pinned binary guarantees generated
 * output matches what `bun run format` and CI's `biome ci .` produce.
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
/**
 * A `.ts` path inside the package that Biome is configured to format. Used as
 * the synthetic `--stdin-file-path` for `lib/generated/**` output, which Biome
 * ignores on disk (see the header note). The file need not exist — only its
 * extension and its position relative to `files.includes` are read.
 */
export declare const TS_FORMAT_PATH: string;
/**
 * Format `source` as the language implied by `filePath`, using the repo's Biome
 * config. Throws on a Biome failure rather than returning unformatted source —
 * a silent pass-through here would land malformed generated code in a commit.
 */
export declare function formatWithBiome(source: string, filePath: string): string;
