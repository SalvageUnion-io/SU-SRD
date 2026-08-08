/**
 * IndexedDB migration registry (plan 2.1, gap 5).
 *
 * One file per version bump: `<n>-<description>.ts` exporting a `migrate`
 * function. The idb `upgrade` callback in `../index.ts` runs every migration
 * whose `toVersion` is greater than the connection's `oldVersion`, in order.
 *
 * Division of labour:
 *   - Object-store CREATION stays in the upgrade callback (../index.ts) —
 *     stores must exist before a migration's record rewrites can run.
 *   - Record REWRITES (schema-shape changes) live here, one file per version.
 *
 * Constraints (IndexedDB versionchange semantics):
 *   - Migrations may only await IndexedDB operations on the provided
 *     transaction. Awaiting anything else (fetch, dynamic import, reference
 *     data) lets the transaction auto-commit mid-migration.
 *   - Never edit a shipped migration — add a new version.
 */

import type { IDBPDatabase, IDBPTransaction, StoreNames } from 'idb'
import { migrate as migrate3CargoToCargoLots } from './3-cargo-to-cargo-lots'
import { migrate as migrate4RemovePilotRollResults } from './4-remove-pilot-roll-results'
import { migrate as migrate6MechRefsToSlugs } from './6-mech-refs-to-slugs'
import { migrate as migrate8CrawlerBattleSpToDerived } from './8-crawler-battle-sp-to-derived'
import { migrate as migrate10WorkspaceDefaultBackfill } from './10-workspace-default-backfill'
import { migrate as migrate11EquipmentLoadoutsToPartners } from './11-equipment-loadouts-to-partners'
import { migrate as migrate12CompanionMechsToPartners } from './12-companion-mechs-to-partners'
import { migrate as migrate13WorkspaceToGameOrShelf } from './13-workspace-to-game-or-shelf'
import { migrate as migrate14StarterSetSeedRef } from './14-starter-set-seed-ref'
import { migrate as migrate15PartnerEquipmentBackfill } from './15-partner-equipment-backfill'

/** The untyped versionchange transaction handed to the idb upgrade callback. */
export type UpgradeTransaction = IDBPTransaction<
  unknown,
  ArrayLike<StoreNames<unknown>>,
  'versionchange'
>

type MigrationFn = (
  tx: UpgradeTransaction,
  db: IDBPDatabase,
  oldVersion: number
) => Promise<void> | void

type Migration = {
  /** The DB version this migration upgrades TO. */
  toVersion: number
  description: string
  migrate: MigrationFn
}

const MIGRATIONS: ReadonlyArray<Migration> = [
  {
    toVersion: 3,
    description: 'cargo-to-cargo-lots',
    migrate: (tx) => migrate3CargoToCargoLots(tx),
  },
  {
    toVersion: 4,
    description: 'remove-pilot-roll-results',
    migrate: (tx) => migrate4RemovePilotRollResults(tx),
  },
  // v5 was store creation only (encounterNpcs) — no record rewrite.
  {
    toVersion: 6,
    description: 'mech-refs-to-slugs',
    migrate: (tx) => migrate6MechRefsToSlugs(tx),
  },
  // v7 was a version-only bump (see ../index.ts) — no record rewrite.
  {
    toVersion: 8,
    description: 'crawler-battle-sp-to-derived',
    migrate: (tx) => migrate8CrawlerBattleSpToDerived(tx),
  },
  // v9 was store creation only (changeLog) — no record rewrite.
  {
    toVersion: 10,
    description: 'workspace-default-backfill',
    migrate: (tx) => migrate10WorkspaceDefaultBackfill(tx),
  },
  {
    toVersion: 11,
    description: 'equipment-loadouts-to-partners',
    migrate: (tx) => migrate11EquipmentLoadoutsToPartners(tx),
  },
  {
    toVersion: 12,
    description: 'companion-mechs-to-partners',
    migrate: (tx) => migrate12CompanionMechsToPartners(tx),
  },
  {
    toVersion: 13,
    description: 'workspace-to-game-or-shelf',
    migrate: (tx) => migrate13WorkspaceToGameOrShelf(tx),
  },
  {
    toVersion: 14,
    description: 'starter-set-seed-ref',
    migrate: (tx) => migrate14StarterSetSeedRef(tx),
  },
  {
    toVersion: 15,
    description: 'partner-equipment-backfill',
    migrate: (tx) => migrate15PartnerEquipmentBackfill(tx),
  },
  // NOTE: the built-in Starter Set is NOT seeded by a migration. It is spawned
  // on-demand into each browser the first time the user opens the Starter Set
  // workspace — see lib/starterSet/seedStarterSet.ts. The built-in DEFAULT
  // workspace, by contrast, IS created (and backfilled) by the v10 migration
  // above — it is mandatory, not on-demand.
]

/**
 * Run all registered migrations for a connection coming from `oldVersion`.
 * Invoked from the idb upgrade callback after object-store creation.
 */
export async function runMigrations(
  db: IDBPDatabase,
  tx: UpgradeTransaction,
  oldVersion: number
): Promise<void> {
  for (const migration of MIGRATIONS) {
    if (oldVersion < migration.toVersion) {
      await migration.migrate(tx, db, oldVersion)
    }
  }
}
