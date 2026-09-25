/**
 * Telemetry for the long tail of IndexedDB migrations (audit AP-19).
 *
 * ## The question this answers
 *
 * `migrations/` carries ten record rewrites (v3–v15). The v3–v12 half exists
 * only for a browser that last opened ITUN before the v13 container migration
 * (ADR-030) — a database old enough to still hold Workspaces, pre-slug mech
 * refs and string cargo. Those files, and the `workspaceId` fallbacks and
 * `@deprecated` schema fields that keep their output readable, are the cost of
 * a population nobody can currently measure.
 *
 * This measures it. Every upgrade that starts below
 * {@link LEGACY_UPGRADE_FLOOR} reports one `info` event naming the version it
 * came from. **When those events stop arriving**, v3–v12 can be replaced by an
 * export-only path — open the old database read-only, offer the rows as a
 * download, and skip the rewrites — and the fallbacks can go with them. The
 * exit criterion and the steps are in `migrations/README.md`.
 *
 * ## Why it is queued rather than sent from the upgrade callback
 *
 * Two reasons, both about losing the event:
 *
 *  - The upgrade runs inside a versionchange transaction that may still abort;
 *    an upgrade that rolled back did not happen, so the report waits for the
 *    open to SUCCEED (`noteLegacyUpgrade` records, `flushLegacyUpgrade` sends).
 *  - The database is opened at boot, usually before the Sentry SDK's dynamic
 *    import has resolved — and a capture before then is a silent no-op. So the
 *    send waits for `observabilityReady()` as well.
 *
 * A fresh database (`oldVersion === 0`) is not an upgrade and is never
 * reported: the event must count old browsers, not new visitors.
 */

import { captureMessage, observabilityReady } from '../observability'

/**
 * The first version whose migrations would survive an export-only cutover.
 * An upgrade from any version below this ran at least one of v3–v12.
 */
export const LEGACY_UPGRADE_FLOOR = 13

type PendingUpgrade = { fromVersion: number; toVersion: number }

let pending: PendingUpgrade | null = null

/**
 * Record that this open is upgrading an old database. Called from the idb
 * `upgrade` callback; sends nothing by itself.
 */
export function noteLegacyUpgrade(oldVersion: number, newVersion: number): void {
  if (oldVersion <= 0 || oldVersion >= LEGACY_UPGRADE_FLOOR) return
  pending = { fromVersion: oldVersion, toVersion: newVersion }
}

type Report = (message: string, context: Record<string, unknown>) => void

let defaultReport: Report = captureMessage

/**
 * Test-only: swap the reporter the database's own open path uses, and get the
 * undo back. `openItunDatabase` calls `flushLegacyUpgrade()` with no
 * arguments, so this is the only way a test can see what a real upgrade sent.
 */
export function _setLegacyUpgradeReporter(report: Report): () => void {
  defaultReport = report
  return () => {
    defaultReport = captureMessage
  }
}

/**
 * Send the recorded upgrade, once, after the open has succeeded and the SDK
 * is up. A no-op when nothing was recorded. The parameters are seams for the
 * tests; production passes neither.
 */
export async function flushLegacyUpgrade(
  report: Report = defaultReport,
  ready: () => Promise<void> = observabilityReady
): Promise<void> {
  const upgrade = pending
  if (upgrade === null) return
  pending = null
  await ready()
  report('itun-db: upgraded a pre-v13 database', {
    fromVersion: upgrade.fromVersion,
    toVersion: upgrade.toVersion,
    floor: LEGACY_UPGRADE_FLOOR,
  })
}
