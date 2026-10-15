import { ConvexReactClient } from 'convex/react'

/**
 * The Convex client. Every build has a deployment: `vite.config.ts` refuses to
 * start without `VITE_CONVEX_URL`.
 */
export const convexClient = new ConvexReactClient(import.meta.env.VITE_CONVEX_URL as string)
