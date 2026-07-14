/**
 * activeWorkspaceStore unit tests.
 *
 * Covers the current-workspace defaults, localStorage persistence, and the
 * React/non-React accessors. localStorage is provided by the happy-dom preload.
 */

import { afterEach, describe, expect, test } from 'bun:test'

import { DEFAULT_WORKSPACE_ID } from '../../lib/defaultWorkspace'
import {
  getActiveWorkspaceId,
  setActiveWorkspaceId,
  useActiveWorkspaceStore,
} from '../activeWorkspaceStore'

afterEach(() => {
  // Reset back to the built-in default so tests don't leak selection state.
  setActiveWorkspaceId(DEFAULT_WORKSPACE_ID)
})

describe('activeWorkspaceStore', () => {
  test('defaults to the Default workspace', () => {
    expect(getActiveWorkspaceId()).toBe(DEFAULT_WORKSPACE_ID)
    expect(useActiveWorkspaceStore.getState().activeWorkspaceId).toBe(DEFAULT_WORKSPACE_ID)
  })

  test('setActiveWorkspaceId updates state and persists to localStorage', () => {
    setActiveWorkspaceId('ws-campaign')
    expect(getActiveWorkspaceId()).toBe('ws-campaign')
    expect(useActiveWorkspaceStore.getState().activeWorkspaceId).toBe('ws-campaign')
    expect(localStorage.getItem('itun.activeWorkspaceId')).toBe('ws-campaign')
  })

  test('switching back to Default persists too', () => {
    setActiveWorkspaceId('ws-other')
    setActiveWorkspaceId(DEFAULT_WORKSPACE_ID)
    expect(getActiveWorkspaceId()).toBe(DEFAULT_WORKSPACE_ID)
    expect(localStorage.getItem('itun.activeWorkspaceId')).toBe(DEFAULT_WORKSPACE_ID)
  })
})
