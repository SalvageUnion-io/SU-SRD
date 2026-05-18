/**
 * workspaceStore — Zustand store for Workspace CRUD + entity assignment helpers.
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
 * Delete workspace semantics: deleting a workspace does NOT cascade to
 * entities. Entities keep their workspaceId pointing at the deleted workspace.
 * They will appear in neither listForWorkspace() (wrong id) nor listUnassigned()
 * (has a non-null workspaceId). Callers must explicitly unassign entities before
 * or after deletion if they want them to return to the unassigned pool. This
 * matches the "soft reference" pattern used throughout the codebase.
 */

import { create } from 'zustand'

import * as db from '../lib/db/index'
import type { Workspace } from '../lib/schemas/workspace'
import type { AssignableType, EntityForType } from './types'
import { useEntityStore } from './entityStore'

type WorkspaceState = {
  workspaces: Workspace[]
  hydrated: boolean

  /** Loads all workspaces from IndexedDB. Idempotent. */
  hydrate: () => Promise<void>

  /** Sync list — returns in-memory workspaces. Auto-triggers hydrate if needed. */
  list: () => Workspace[]

  /** Sync get by id or null. */
  get: (id: string) => Workspace | null

  /** Creates a workspace with the given name. */
  create: (input: { name: string }) => Promise<Workspace>

  /** Renames a workspace. */
  rename: (id: string, name: string) => Promise<Workspace>

  /**
   * Deletes the workspace record. Does NOT cascade to entities — entities
   * retain their workspaceId. See module docblock for rationale.
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
   * Returns all entities of the given type with no workspaceId.
   * Reads from entityStore in-memory state. Caller should ensure hydration
   * of the entity type before calling.
   */
  listUnassigned: <T extends AssignableType>(type: T) => EntityForType<T>[]
}

export const useWorkspaceStore = create<WorkspaceState>((set, get) => ({
  workspaces: [],
  hydrated: false,

  async hydrate() {
    if (get().hydrated) return
    const records = await db.workspaces.list()
    set({ workspaces: records, hydrated: true })
  },

  list() {
    const state = get()
    if (!state.hydrated) {
      void state.hydrate()
    }
    return state.workspaces
  },

  get(id) {
    const state = get()
    if (!state.hydrated) {
      void state.hydrate()
    }
    return state.workspaces.find((w) => w.id === id) ?? null
  },

  async create(input) {
    const record = await db.workspaces.create({
      schemaVersion: 1,
      name: input.name,
    })
    set((state) => ({ workspaces: [record, ...state.workspaces] }))
    return record
  },

  async rename(id, name) {
    const updated = await db.workspaces.update(id, { name })
    set((state) => ({
      workspaces: state.workspaces.map((w) => (w.id === id ? updated : w)),
    }))
    return updated
  },

  async delete(id) {
    await db.workspaces.delete(id)
    set((state) => ({ workspaces: state.workspaces.filter((w) => w.id !== id) }))
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
    const entities = useEntityStore.getState().list(type)
    return (entities as (EntityForType<T> & { workspaceId?: string })[]).filter(
      (e) => !e.workspaceId
    )
  },
}))
