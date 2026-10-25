/**
 * lib/entities — the typed reactive read layer over the Zustand stores.
 *
 * Components subscribe through these hooks instead of ad-hoc
 * `useUnits((s) => …)` selectors; event handlers keep using
 * `useUnits.getState()` imperatively.
 */

// `useEntity` is deliberately NOT re-exported: it is the generic these are
// built on. `usePilot` /
// `useMech` are the typed way in — a caller wanting the generic is usually
// about to lose the narrowing those give it.
export {
  useCrawlers,
  useMech,
  useMechs,
  useNpcs,
  usePilot,
  usePilots,
  useSoftLinkList,
} from './entities'
export { useHydrateEntities } from './useHydrateEntities'
