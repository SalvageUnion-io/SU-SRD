/**
 * hooks/queries — the typed reactive read layer over the Zustand stores
 * (design review T-7).
 *
 * Components subscribe through these hooks instead of ad-hoc
 * `useEntityStore((s) => …)` selectors; event handlers keep using
 * `useEntityStore.getState()` imperatively.
 */

// `useEntity` is deliberately NOT re-exported: it is the generic these are
// built on, and its last consumer went with the share screen. `usePilot` /
// `useMech` are the typed way in — a caller wanting the generic is usually
// about to lose the narrowing those give it.
export {
  useCrawlers,
  useMech,
  useMechs,
  usePilot,
  usePilots,
  useSoftLinkList,
} from './entities'
export { useHydrateEntities } from './useHydrateEntities'
