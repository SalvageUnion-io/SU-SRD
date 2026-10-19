/**
 * The forms' no-React halves that a static page runs (`runtime/islands.client.ts`):
 * every list's chip lanes and a contentful Token's +MORE, joined on the SSG's
 * markup. Kept apart from the module's face (`index.ts`), which reaches React
 * components: the island entry ships at page load, under its byte budget
 * (`reference-bundle-budget.e2e.ts`).
 */

export { watchStaticMore } from './parts/chipFit'
export { joinStaticLanes } from './parts/chipLanes'
