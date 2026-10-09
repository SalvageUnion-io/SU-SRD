/**
 * ITUN's `lib/connection/convexClient` as the catalog sees it (the alias is in
 * `vite.config.ts`). ITUN's stories render presentational frames, but their
 * imports reach the entity store, and the real module constructs a client from
 * `VITE_CONVEX_URL` at evaluation, which the catalog does not have. A story
 * that writes to Convex fails here, loudly, at the call.
 */
const noDeployment = (): never => {
  throw new Error('The component catalog has no Convex deployment')
}

export const convexClient = { mutation: noDeployment }
