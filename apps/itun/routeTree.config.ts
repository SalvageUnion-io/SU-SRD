/**
 * TanStack Router's file-route options — one object, read by two callers:
 * the Vite plugin in `vite.config.ts` (which generates `src/routeTree.gen.ts`
 * on every dev start and build) and `scripts/generate-route-tree.ts` (which
 * generates it WITHOUT a build, so `tools/check-generated.ts` can prove the
 * committed tree is current in a couple of hundred milliseconds rather than a
 * full Vite build). Two copies of these options would generate two different
 * trees the day one of them changed.
 */
export const ROUTER_PLUGIN_OPTIONS = {
  routesDirectory: './src/routes',
  generatedRouteTree: './src/routeTree.gen.ts',
  // Split each route's component out of the entry bundle so a visitor
  // pays only for the route they land on. Without this every route
  // (roster, the three wizards, both sheets, dashboard, encounter,
  // snapshot viewer) is linked into one ~1.2 MB entry chunk, and the
  // per-route JS budget in e2e/bundle-budget.e2e.ts is what keeps it
  // that way. Route *definitions* (path, loader, params) stay eager so
  // matching still happens synchronously; only the component/pending/
  // error boundaries move behind a dynamic import.
  autoCodeSplitting: true,
} as const
