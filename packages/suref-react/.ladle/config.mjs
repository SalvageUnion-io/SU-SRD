export default {
  stories: 'src/**/*.stories.{ts,tsx}',
  outDir: 'build-ladle',
  viteConfig: './vite.config.ts',
  // Sidebar taxonomy, read top-to-bottom: Foundations (tokens + layout + the
  // Rendering Matrix QA harness) → Atoms (indivisible primitives) → Containers
  // (content-agnostic wrappers: Display Card / Modal / Inset / Toast / …) →
  // Compositions (domain/game components) → Legacy (the drain, currently empty).
  // Group definitions live in packages/suref-react/CLAUDE.md.
  //
  // NOTE: Ladle serializes this function and evaluates it in the browser
  // WITHOUT the surrounding module scope, so it must be fully self-contained —
  // no references to outer-scope consts/helpers.
  storyOrder: (stories) => {
    const order = ['foundations', 'atoms', 'containers', 'compositions', 'legacy']
    const rank = (id) => {
      const i = order.findIndex((g) => id.startsWith(g))
      return i === -1 ? order.length : i
    }
    return [...stories].sort((a, b) => {
      const r = rank(a) - rank(b)
      return r !== 0 ? r : a.localeCompare(b)
    })
  },
}
