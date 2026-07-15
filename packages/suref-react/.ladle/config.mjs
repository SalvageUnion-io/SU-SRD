// Sidebar taxonomy — the Ladle catalog mirrors the design "codex": read it
// top-to-bottom as Codex overview → Foundations (tokens) → Atoms (the
// irreducible set) → Compositions → Containers → Reference Entity internals.
const GROUP_ORDER = [
  'codex',
  'foundations',
  'atoms',
  'compositions',
  'containers',
  'reference-entity',
]

function groupRank(id) {
  const i = GROUP_ORDER.findIndex((g) => id.startsWith(g))
  return i === -1 ? GROUP_ORDER.length : i
}

export default {
  stories: 'src/**/*.stories.{ts,tsx}',
  outDir: 'build-ladle',
  viteConfig: './vite.config.ts',
  // Order groups by GROUP_ORDER, then alphabetically within each group.
  storyOrder: (stories) =>
    [...stories].sort((a, b) => {
      const r = groupRank(a) - groupRank(b)
      return r !== 0 ? r : a.localeCompare(b)
    }),
}
