/**
 * hooks/queries — the typed reactive read layer over the Zustand stores
 * (design review T-7).
 *
 * Components subscribe through these hooks instead of ad-hoc
 * `useEntityStore((s) => …)` selectors; event handlers keep using
 * `useEntityStore.getState()` imperatively.
 */

export {
  useCrawlers,
  useEntity,
  useMech,
  useMechs,
  usePilot,
  usePilots,
  useSoftLinkList,
} from './entities'

export { useHydrateEntities } from './useHydrateEntities'
