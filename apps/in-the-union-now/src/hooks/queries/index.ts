/**
 * hooks/queries — the typed reactive read layer over the Zustand stores
 * (design review T-7).
 *
 * Components subscribe through these hooks instead of ad-hoc
 * `useEntityStore((s) => …)` selectors; event handlers keep using
 * `useEntityStore.getState()` imperatively and can share the exported
 * `select*` functions.
 */

export {
  selectCrawlers,
  selectEntityById,
  selectEntityList,
  selectMechs,
  selectPilots,
  selectSoftLinks,
  useCrawler,
  useCrawlers,
  useEntity,
  useEntityList,
  useMech,
  useMechs,
  usePilot,
  usePilots,
  useSoftLinkList,
} from './entities'
export type { EntityStoreState } from './entities'

export {
  selectWorkspaceById,
  selectWorkspaces,
  useWorkspace,
  useWorkspaceActions,
  useWorkspaces,
} from './workspaces'
export type { WorkspaceActions, WorkspaceStoreState } from './workspaces'

export { useHydrateEntities } from './useHydrateEntities'
