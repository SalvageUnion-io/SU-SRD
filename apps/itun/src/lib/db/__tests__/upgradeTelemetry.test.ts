/**
 * The pre-v13 upgrade signal (audit AP-19).
 *
 * The event decides when v3–v12 can be retired, so what matters is that it
 * counts the right thing: old databases that really upgraded, once each — never
 * a fresh install, never an upgrade that did not happen. The last case drives a
 * real upgrade through `openItunDatabase` against `fake-indexeddb`.
 */

import { afterEach, describe, expect, test } from 'bun:test'
import { openDB } from 'idb'
import { DB_VERSION, openItunDatabase } from '../index'
import {
  _setLegacyUpgradeReporter,
  flushLegacyUpgrade,
  LEGACY_UPGRADE_FLOOR,
  noteLegacyUpgrade,
} from '../upgradeTelemetry'

type Sent = { message: string; context: Record<string, unknown> }

function recorder() {
  const sent: Sent[] = []
  const report = (message: string, context: Record<string, unknown>) => {
    sent.push({ message, context })
  }
  return { sent, report }
}

const ready = async () => {}

afterEach(async () => {
  // Module-scope queue: drain it so nothing leaks into the next test or file.
  await flushLegacyUpgrade(() => {}, ready)
})

describe('what counts as a legacy upgrade', () => {
  test('an upgrade from below the floor is reported once, with where it came from', async () => {
    const { sent, report } = recorder()
    noteLegacyUpgrade(9, 15)

    await flushLegacyUpgrade(report, ready)
    await flushLegacyUpgrade(report, ready)

    expect(sent).toHaveLength(1)
    expect(sent[0]?.context).toEqual({ fromVersion: 9, toVersion: 15, floor: LEGACY_UPGRADE_FLOOR })
  })

  test('a fresh database is not an upgrade', async () => {
    // Counting new visitors would keep the signal loud forever, and the
    // migrations it is meant to retire would never look retirable.
    const { sent, report } = recorder()
    noteLegacyUpgrade(0, 15)
    await flushLegacyUpgrade(report, ready)
    expect(sent).toEqual([])
  })

  test('an upgrade from the floor or later is not legacy', async () => {
    const { sent, report } = recorder()
    noteLegacyUpgrade(LEGACY_UPGRADE_FLOOR, 15)
    await flushLegacyUpgrade(report, ready)
    expect(sent).toEqual([])
  })

  test('the send waits for observability to be ready', async () => {
    // A capture before the SDK lands is a silent no-op, and the database is
    // opened at boot — so an unawaited send would lose nearly every event.
    const order: string[] = []
    noteLegacyUpgrade(5, 15)
    await flushLegacyUpgrade(
      () => order.push('sent'),
      async () => {
        order.push('ready')
      }
    )
    expect(order).toEqual(['ready', 'sent'])
  })
})

describe('through a real open', () => {
  test('opening a v12 database records the upgrade', async () => {
    const name = `itun-telemetry-${crypto.randomUUID()}`
    // A v12-shaped database: the stores exist, the version is old.
    const old = await openDB(name, 12, {
      upgrade(db) {
        for (const store of ['pilots', 'mechs', 'crawlers', 'workspaces', 'softLinks']) {
          db.createObjectStore(store, { keyPath: 'id' })
        }
        db.createObjectStore('mechPatterns', { keyPath: 'id' })
        db.createObjectStore('encounterNpcs', { keyPath: 'id' })
        db.createObjectStore('changeLog', { keyPath: 'seq', autoIncrement: true })
      },
    })
    old.close()

    const { sent, report } = recorder()
    const restore = _setLegacyUpgradeReporter(report)
    try {
      const upgraded = await openItunDatabase(name)
      upgraded.close()
      expect(upgraded.version).toBe(DB_VERSION)
      // Sent from the open's own success path, after `observabilityReady()`.
      await Promise.resolve()
      await new Promise<void>((resolve) => queueMicrotask(resolve))
    } finally {
      restore()
    }

    expect(sent.map((s) => s.context.fromVersion)).toEqual([12])
  })
})
