/**
 * workspaceStore — Zustand store for Workspace CRUD + entity assignment helpers.
 *
 * CRUD/hydration comes from makeHydratedCollectionSlice (ADR-003 discipline).
 * Domain helpers stay here:
 *
 * Assignment helpers: assign/unassign mutate the entity's `workspaceId` field
 * by delegating to useEntityStore.update(). This keeps entity state
 * authoritative in entityStore and avoids duplicating in-memory arrays.
 *
 * listForWorkspace / listUnassigned read from useEntityStore's in-memory
 * state via getState() (not a subscription). Callers that need reactivity
 * should subscribe to entityStore directly; these helpers are convenience
 * accessors for one-shot reads or derive-at-call-time patterns.
 *
 * Delete workspace semantics (plan 2.7, gap 9): deleting a workspace CASCADES
 * — every member entity's `workspaceId` is cleared first, so members return
 * to the unassigned pool instead of becoming invisible (assigned to a
 * workspace that no longer exists). As a second line of defence,
 * listUnassigned() also treats entities whose workspaceId points at an
 * unknown workspace as unassigned (records written before the cascade
 * existed, or imported from another browser).
 */

import { create } from 'zustand'

import * as db from '../lib/db/index'
import { STORE_NAMES } from '../lib/db/stores'
import type { Workspace } from '../lib/schemas/workspace'
import type { AssignableType, EntityForType } from './types'
import { useEntityStore } from './entityStore'
import {
  makeHydratedCollectionSlice,
  wireCrossTabInvalidation,
  type HydratedCollectionActions,
  type HydratedCollectionSlice,
} from './makeHydratedCollection'

const ASSIGNABLE_TYPES: AssignableType[] = ['pilot', 'mech', 'crawler']

type WorkspaceCreateInput = { schemaVersion: 1; name: string }

type WorkspaceState = HydratedCollectionSlice<'workspaces', Workspace> &
  Omit<HydratedCollectionActions<Workspace, WorkspaceCreateInput>, 'create' | 'delete'> & {
    /** Creates a workspace with the given name. */
    create: (input: { name: string }) => Promise<Workspace>

    /** Renames a workspace. */
    rename: (id: string, name: string) => Promise<Workspace>

    /**
     * Deletes the workspace record AND clears workspaceId on every member
     * entity (cascade) so members return to the unassigned pool.
     */
    delete: (id: string) => Promise<void>

    /**
     * Sets entity.workspaceId to workspaceId.
     * Delegates to entityStore.update() so entity in-memory state stays
     * consistent.
     */
    assign: (entityType: AssignableType, entityId: string, workspaceId: string) => Promise<void>

    /**
     * Clears entity.workspaceId (sets to undefined).
     * Delegates to entityStore.update().
     */
    unassign: (entityType: AssignableType, entityId: string) => Promise<void>

    /**
     * Returns all entities of the given type assigned to workspaceId.
     * Reads from entityStore in-memory state. Caller should ensure hydration
     * of the entity type before calling.
     */
    listForWorkspace: <T extends AssignableType>(workspaceId: string, type: T) => EntityForType<T>[]

    /**
     * Returns all entities of the given type with no workspaceId — plus, as the
     * dashboard fallback, entities whose workspaceId points at a workspace that
     * no longer exists. Caller should ensure hydration of both the entity type
     * and workspaces before calling.
     */
    listUnassigned: <T extends AssignableType>(type: T) => EntityForType<T>[]
  }

const slice = makeHydratedCollectionSlice<'workspaces', Workspace, WorkspaceCreateInput>({
  key: 'workspaces',
  db: db.workspaces,
  storeName: STORE_NAMES.workspaces,
})

export const useWorkspaceStore = create<WorkspaceState>((set, get) => {
  const base = slice(set, get)
  return {
    ...base,

    async create(input: { name: string }) {
      return base.create({ schemaVersion: 1, name: input.name })
    },

    async rename(id, name) {
      return base.update(id, { name })
    },

    async delete(id) {
      // Cascade FIRST: clear workspaceId on every member so nothing is left
      // pointing at a workspace that no longer exists (plan 2.7, gap 9).
      const entityStore = useEntityStore.getState()
      for (const type of ASSIGNABLE_TYPES) {
        await entityStore.hydrate(type)
        const members = (
          entityStore.list(type) as (EntityForType<typeof type> & {
            workspaceId?: string
          })[]
        ).filter((e) => e.workspaceId === id)
        for (const member of members) {
          await entityStore.update(type, member.id, {
            workspaceId: undefined,
          } as Partial<EntityForType<typeof type>>)
        }
      }
      await base.delete(id)
    },

    async assign(entityType, entityId, workspaceId) {
      await useEntityStore
        .getState()
        .update(entityType, entityId, { workspaceId } as Partial<EntityForType<typeof entityType>>)
    },

    async unassign(entityType, entityId) {
      await useEntityStore
        .getState()
        .update(entityType, entityId, { workspaceId: undefined } as Partial<
          EntityForType<typeof entityType>
        >)
    },

    listForWorkspace<T extends AssignableType>(workspaceId: string, type: T): EntityForType<T>[] {
      const entities = useEntityStore.getState().list(type)
      return (entities as (EntityForType<T> & { workspaceId?: string })[]).filter(
        (e) => e.workspaceId === workspaceId
      )
    },

    listUnassigned<T extends AssignableType>(type: T): EntityForType<T>[] {
      const knownIds = new Set(
        get()
          .list()
          .map((w) => w.id)
      )
      const entities = useEntityStore.getState().list(type)
      return (entities as (EntityForType<T> & { workspaceId?: string })[]).filter(
        (e) => !e.workspaceId || !knownIds.has(e.workspaceId)
      )
    },
  }
})

wireCrossTabInvalidation(useWorkspaceStore, STORE_NAMES.workspaces)
