/**
 * The built-in "Default workspace" — the workspace every install starts in.
 *
 * Unlike the on-demand Starter Set (lib/starterSet/), the Default workspace is
 * MANDATORY and always present: workspaces are the organizing primitive (there
 * is no cross-workspace "All Builds" view), so there must always be a current
 * workspace to land in and to stamp new builds with. It is created — and every
 * pre-existing unassigned build is backfilled into it — by the v10 DB migration
 * (db/migrations/10-workspace-default-backfill.ts), which runs on both fresh
 * installs (0 → 10) and upgrades (9 → 10). It carries NO seeded entities.
 *
 * The id/createdAt are FIXED constants (like the Starter Set) so the migration
 * is idempotent and the record never sorts ahead of the user's own builds.
 */

import type { Workspace } from './schemas/workspace'

/** Deterministic id of the built-in Default workspace. */
export const DEFAULT_WORKSPACE_ID = 'default-workspace'

/** User-facing name of the built-in Default workspace. */
export const DEFAULT_WORKSPACE_NAME = 'Default workspace'

/** Fixed creation timestamp (see file header — determinism). */
const DEFAULT_WORKSPACE_TS = '2020-01-01T00:00:00.000Z'

export const DEFAULT_WORKSPACE: Workspace = {
  id: DEFAULT_WORKSPACE_ID,
  schemaVersion: 1,
  name: DEFAULT_WORKSPACE_NAME,
  createdAt: DEFAULT_WORKSPACE_TS,
}
