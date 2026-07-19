export default {
  stories: 'src/**/*.stories.{ts,tsx}',
  outDir: 'build-ladle',
  viteConfig: './vite.config.ts',
  // Shell relayout (injected into Ladle's own <head> — the officially-blessed
  // route for "repositioning the sidebar"). Ladle already docks the addon/controls
  // toolbar (.ladle-addons) at the bottom natively; here we turn the nav
  // (.ladle-aside) into a HORIZONTAL bar docked at the bottom, with its story-tree
  // lists laid out left-to-right (overflow-x scroll). Story content (.ladle-main)
  // keeps the full width + height above it. Desktop only — Ladle is already a
  // bottom-stacked column on mobile. These target Ladle's internal shell classes
  // (not a public API); they are pinned to @ladle/react 5.1.1 — RE-VERIFY on any
  // Ladle upgrade (see docs/design-system/ladle-styleguide.md §5.5/§9).
  appendToHead: `
    <style>
      @media (min-width: 768px) {
        /* nav → horizontal bar along the bottom edge */
        .ladle-aside {
          position: fixed !important;
          left: 0; right: 0; bottom: 0; top: auto !important;
          height: 3rem;
          min-width: 0 !important;
          max-width: none !important;
          flex: none !important;
          z-index: 100;
          display: flex !important;
          flex-flow: row nowrap;
          align-items: center;
          gap: 0.5rem;
          padding: 0 0.75rem;
          overflow-x: auto;
          overflow-y: hidden;
          white-space: nowrap;
          background: var(--ladle-bg-color-secondary);
          border-top: 2px solid var(--ladle-color-accent, #6b7280);
          box-shadow: 0 -6px 20px rgba(0, 0, 0, 0.18);
        }
        /* lay the story-tree lists out horizontally */
        .ladle-aside ul {
          display: flex !important;
          flex-flow: row nowrap;
          align-items: center;
          gap: 0.25rem;
          margin: 0;
          padding: 0;
          list-style: none;
        }
        .ladle-aside li { flex: 0 0 auto; }
        /* keep the search box compact at the start rather than full-width */
        .ladle-aside input { width: 12rem; flex: 0 0 auto; }
        /* full-bleed story content above the bar */
        .ladle-main {
          width: 100% !important;
          max-width: none !important;
          padding-bottom: 4rem;
        }
        .ladle-resize-handle { display: none !important; }
        /* raise the controls to sit just above the horizontal nav bar */
        .ladle-addons {
          inset-inline-start: auto !important;
          inset-inline-end: 0.75rem !important;
          bottom: 3.5rem !important;
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
