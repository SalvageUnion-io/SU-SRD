/**
 * lib/entities — the typed reactive read layer over the Zustand stores.
 *
 * Components subscribe through these hooks instead of ad-hoc
 * `useUnits((s) => …)` selectors; event handlers keep using
 * `useUnits.getState()` imperatively.
 */

export { useCrawlers, useMechs, useNpcs, usePilots, useSoftLinkList } from './entities'
export { useHydrateEntities } from './useHydrateEntities'
