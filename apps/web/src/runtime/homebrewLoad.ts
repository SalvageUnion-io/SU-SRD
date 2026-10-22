/**
 * The Homebrew island one hop away: the island entry every SRD page loads
 * names this chunk alone, not the island's own preload list (the page-load
 * JS budget, `e2e/reference-bundle-budget.e2e.ts`).
 */
export const loadHomebrewIsland = () =>
  import('../components/islands/HomebrewIsland').then((m) => m.HomebrewIsland)
