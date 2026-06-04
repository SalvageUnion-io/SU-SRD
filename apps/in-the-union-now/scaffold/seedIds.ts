/**
 * THROWAWAY DEV SCAFFOLD — Slice G (#239).
 *
 * Stable seed ids, split into their own dependency-free module so the dev route
 * can import them statically (for building links) WITHOUT pulling the heavy
 * `seed.ts` (idb + reference data + schemas + store) into the production bundle.
 * The seed logic itself is dynamically imported only inside the DEV-gated branch.
 *
 * >>> REMOVAL NOTE (delete before #239 merges): part of the throwaway scaffold/.
 */
export const SEED_IDS = {
  pilot: 'seed-pilot-0000',
  mech: 'seed-mech-0000',
  crawler: 'seed-crawler-0000',
  linkMechPilot: 'seed-link-mech-pilot',
  linkPilotCrawler: 'seed-link-pilot-crawler',
} as const
