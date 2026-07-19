export default {
  stories: 'src/**/*.stories.{ts,tsx}',
  outDir: 'build-ladle',
  viteConfig: './vite.config.ts',
  // Shell relayout (injected into Ladle's own <head> — the officially-blessed
  // route for "repositioning the sidebar"). Ladle already docks the addon/controls
  // toolbar (.ladle-addons) at the bottom natively; here we pull the nav
  // (.ladle-aside) out of the flex row and dock it as a BOTTOM auto-hiding
  // overlay, so story content (.ladle-main) is always full-width + full-height
  // and the nav reveals on hover / focus-within (focus-within preserves the '/'
  // search reveal). Desktop only — Ladle is already a bottom-stacked column on
  // mobile. These target Ladle's internal shell classes (not a public API); they
  // are pinned to @ladle/react 5.1.1 — RE-VERIFY on any Ladle upgrade (see
  // docs/design-system/ladle-styleguide.md §9). To switch the nav to a left-edge
  // overlay instead, change the .ladle-aside block to left/top/bottom:0 with a
  // collapsed width + :hover width, per the same doc.
  appendToHead: `
    <style>
      @media (min-width: 768px) {
        .ladle-aside {
          position: fixed !important;
          left: 0; right: 0; bottom: 0; top: auto !important;
          height: 2.5rem;
          min-width: 0 !important;
          max-width: none !important;
          flex: none !important;
          z-index: 100;
          overflow: hidden;
          border-top: 2px solid var(--ladle-color-accent, #6b7280);
          box-shadow: 0 -6px 20px rgba(0, 0, 0, 0.18);
          transition: height 0.16s ease-out;
        }
        .ladle-aside:hover,
        .ladle-aside:focus-within {
          height: 55vh;
          overflow: auto;
        }
        .ladle-main {
          width: 100% !important;
          max-width: none !important;
          padding-bottom: 3.5rem;
        }
        .ladle-resize-handle { display: none !important; }
        .ladle-addons {
          inset-inline-start: auto !important;
          inset-inline-end: 1rem !important;
        }
      }
    </style>
  `,
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
  // packages/component-lib/CLAUDE.md.
  //
  // NOTE: Ladle serializes this function and evaluates it in the browser
  // WITHOUT the surrounding module scope, so it must be fully self-contained —
  // no references to outer-scope consts/helpers.
  storyOrder: (stories) => {
    const order = ['foundations', 'atoms', 'containers', 'compositions']
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
