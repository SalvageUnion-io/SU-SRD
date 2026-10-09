export default {
  // The library's own stories, plus the app-owned components that left the
  // library in the component-lib boundary audit (PK-02): ITUN's Dashboard
  // instruments, live-sheet presentation and wizard steps, and srd's
  // site-only components. They live beside their components in the apps, and
  // stay in this one catalog so a redesign still has a Ladle page to compare
  // against. `src/story-coverage.test.ts` holds all three roots to the same
  // taxonomy, and `src/styles/ladle.css` points Tailwind at the app folders.
  stories: [
    'src/**/*.stories.{ts,tsx}',
    '../../apps/itun/src/components/**/*.stories.tsx',
    '../../apps/srd/src/components/**/*.stories.tsx',
  ],
  outDir: 'build-ladle',
  viteConfig: './vite.config.ts',
  // Open on the orientation page (Foundations/Styleguide → Overview) instead of
  // whatever sorts first, so the catalog has a front door. Story id joins every
  // title segment and the export name with '--' (Foundations/Styleguide +
  // Overview → foundations--styleguide--overview).
  defaultStory: 'foundations--styleguide--overview',
  // Per-component accessibility checks (axe-core). Off by default in Ladle; a
  // styleguide is exactly where you want the a11y panel, so it's on here.
  addons: {
    a11y: { enabled: true },
  },
  // Sidebar taxonomy, read top-to-bottom: Foundations (tokens + layout + the
  // Rendering Matrix QA harness) → Atoms (indivisible primitives) → Containers
  // (content-agnostic wrappers: Display Card / Modal / Inset / Toast / …) →
  // Compositions (domain/game components). Group definitions live in
  // packages/component-lib/CLAUDE.md, and `src/story-coverage.test.ts` fails CI
  // if a story's title uses a group or sub-group not listed here.
  //
  // Compositions is the only group big enough to earn sub-groups; a cluster gets
  // one at 3+ siblings, and they sort ahead of that group's ungrouped leaves.
  // Atoms/Containers stay deliberately flat — they are lists of peers, which
  // stays scannable and keeps '/' search a single hop.
  //
  // NOTE: Ladle serializes this function and evaluates it in the browser
  // WITHOUT the surrounding module scope, so it must be fully self-contained —
  // no references to outer-scope consts/helpers.
  storyOrder: (stories) => {
    const groups = ['foundations', 'atoms', 'containers', 'compositions']
    const subgroups = {
      compositions: ['entity', 'catalog', 'dashboard', 'wizard', 'shell'],
    }
    const rank = (id) => {
      let g = groups.findIndex((name) => id.startsWith(`${name}--`))
      if (g === -1) g = groups.length
      const group = groups[g]
      const subs = (group && subgroups[group]) || []
      // Ungrouped leaves sort after the group's sub-grouped clusters.
      let s = subs.findIndex((name) => id.startsWith(`${group}--${name}--`))
      if (s === -1) s = subs.length
      return [g, s]
    }
    return [...stories].sort((a, b) => {
      const ra = rank(a)
      const rb = rank(b)
      return ra[0] - rb[0] || ra[1] - rb[1] || a.localeCompare(b)
    })
  },
}
