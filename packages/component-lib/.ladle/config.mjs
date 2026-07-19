export default {
  stories: 'src/**/*.stories.{ts,tsx}',
  outDir: 'build-ladle',
  viteConfig: './vite.config.ts',
  // Shell relayout (injected into Ladle's own <head> — the officially-blessed
  // route for "repositioning the sidebar"). Ladle already docks the addon/controls
  // toolbar (.ladle-addons) at the bottom natively; here we keep the nav
  // (.ladle-aside) as the standard vertical story tree but turn it into a LEFT-EDGE
  // auto-hiding overlay: collapsed to a thin strip on the left, it slides open
  // HORIZONTALLY (width grows) on hover / focus-within (focus-within preserves the
  // '/' search reveal) and overlays the content, so story content (.ladle-main)
  // stays full-width. Desktop only — Ladle is already a stacked column on mobile.
  // These target Ladle's internal shell classes (not a public API); pinned to
  // @ladle/react 5.1.1 — RE-VERIFY on any Ladle upgrade (see
  // docs/design-system/ladle-styleguide.md §5.5/§9).
  appendToHead: `
    <style>
      @media (min-width: 768px) {
        .ladle-aside {
          position: fixed !important;
          left: 0; top: 0; bottom: 0; right: auto !important;
          width: 3rem;
          min-width: 0 !important;
          max-width: none !important;
          flex: none !important;
          z-index: 100;
          overflow: hidden;
          border-right: 2px solid var(--ladle-color-accent, #6b7280);
          box-shadow: 6px 0 20px rgba(0, 0, 0, 0.18);
          transition: width 0.16s ease-out;
        }
        .ladle-aside:hover,
        .ladle-aside:focus-within {
          width: 18rem;
          overflow: auto;
        }
        .ladle-main {
          width: 100% !important;
          max-width: none !important;
          padding-left: 3.5rem;
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
