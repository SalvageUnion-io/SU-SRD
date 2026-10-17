/**
 * The GritQL plugins in `packages/gates/biome/` and the app's function-size cap
 * are wired up by `includes` globs in biome.jsonc, and the real tree is clean.
 * A bad glob, or a Biome update that changes how plugins match, would make a
 * rule check nothing while `bun run check`
 * stays green. These lint fixture files and assert each rule still fires.
 *
 * The fixtures go in a throwaway copy of the repo's layout: biome.jsonc and the
 * .grit files copied byte for byte, with each fixture at the same relative path
 * it would have in the repo. Writing them into the real tree would put
 * deliberate violations in front of the `biome`, `typecheck` and `knip` gates
 * that `bun run check` and pre-push run alongside this suite. Biome's stdin
 * mode is not an option: it reports no plugin diagnostics.
 */
export {};
