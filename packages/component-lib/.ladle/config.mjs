export default {
  stories: 'src/**/*.stories.{ts,tsx}',
  outDir: 'build-ladle',
  viteConfig: './vite.config.ts',
  // Shell relayout (injected into Ladle's own <head> — the officially-blessed
  // route for "repositioning the sidebar"). Ladle already docks the addon/controls
  // toolbar (.ladle-addons) at the bottom natively; here the nav (.ladle-aside)
  // becomes a HAMBURGER-TOGGLED right-edge overlay rather than a hover-reveal
  // strip. It was a 3rem sliver that expanded on hover — discoverable only if you
  // knew to aim at it, and easy to open by accident. Now a fixed hamburger button
  // (top-right) toggles the full nav in and out; the panel is off-screen until
  // opened, so story content (.ladle-main) is always full-width. Escape closes it,
  // and '/' opens it before focusing search (Ladle's shortcut lives inside the
  // aside, which is off-screen when closed). Desktop only — Ladle is a stacked
  // column with its own nav on mobile, so the button and overlay hide below 768px.
  //
  // The toggle button is appended to <body>, OUTSIDE Ladle's React root, so React
  // never reconciles it away; the open/closed state is a class on <html>, also
  // outside React. These target Ladle's internal shell classes (not a public API);
  // pinned to @ladle/react 5.1.1 — RE-VERIFY on any Ladle upgrade (see
  // docs/design-system/ladle-styleguide.md §5.5/§9).
  appendToHead: `
    <style>
      #ladle-nav-toggle { display: none; }
      @media (min-width: 768px) {
        .ladle-aside {
          position: fixed !important;
          right: 0; top: 0; bottom: 0; left: auto !important;
          width: 18rem;
          min-width: 0 !important;
          max-width: none !important;
          flex: none !important;
          z-index: 100;
          overflow: auto;
          border-left: 2px solid var(--ladle-color-accent, #6b7280);
          box-shadow: -6px 0 20px rgba(0, 0, 0, 0.18);
          transform: translateX(100%);
          transition: transform 0.18s ease-out;
        }
        html.ladle-nav-open .ladle-aside { transform: translateX(0); }
        .ladle-main {
          width: 100% !important;
          max-width: none !important;
        }
        .ladle-resize-handle { display: none !important; }
        .ladle-addons {
          inset-inline-start: 1rem !important;
          inset-inline-end: auto !important;
        }
        #ladle-nav-toggle {
          position: fixed;
          top: 0.75rem;
          right: 0.75rem;
          z-index: 101;
          display: flex;
          align-items: center;
          justify-content: center;
          width: 2.5rem;
          height: 2.5rem;
          padding: 0;
          font-size: 1.25rem;
          line-height: 1;
          cursor: pointer;
          background: var(--ladle-color-background, #fff);
          color: var(--ladle-color-text, #111);
          border: 2px solid var(--ladle-color-accent, #6b7280);
          border-radius: 0.375rem;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
          transition: right 0.18s ease-out;
        }
        html.ladle-nav-open #ladle-nav-toggle { right: 18.75rem; }
      }
    </style>
    <script>
      (function () {
        function ensureToggle() {
          if (!document.body || document.getElementById('ladle-nav-toggle')) return;
          var btn = document.createElement('button');
          btn.id = 'ladle-nav-toggle';
          btn.type = 'button';
          btn.setAttribute('aria-label', 'Toggle navigation');
          btn.textContent = '\\u2630';
          btn.addEventListener('click', function () {
            document.documentElement.classList.toggle('ladle-nav-open');
          });
          document.body.appendChild(btn);
        }
        document.addEventListener('keydown', function (e) {
          if (e.key === 'Escape') {
            document.documentElement.classList.remove('ladle-nav-open');
          } else if (e.key === '/' && document.activeElement &&
                     document.activeElement.tagName !== 'INPUT' &&
                     document.activeElement.tagName !== 'TEXTAREA') {
            document.documentElement.classList.add('ladle-nav-open');
          }
        });
        if (document.body) ensureToggle();
        else document.addEventListener('DOMContentLoaded', ensureToggle);
      })();
    </script>
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
