/**
 * AccountReconciler — the one surface that moves local work into the account.
 *
 * ## What this replaced
 *
 * Four root-mounted pieces, each reconciling on its own: `UnsavedWorkBanner`
 * (anonymous work in this tab), `AnonymousWorkPromoter` (uploading it on
 * sign-in), `LegacyLocalData` (a pre-account roster in IndexedDB: a second
 * banner signed out, a second upload and a second error line signed in), and
 * `ShelfSync` (the download direction, which had to be told about the other
 * three through module-scope flags). The rule now lives once in
 * `lib/account/reconcile.ts`, and this is its only UI. Since signing out made
 * ITUN read-only (ADR-034 decision 1, as amended) there is no anonymous work
 * to carry, so the only local work left is the device's.
 *
 * ## Signed out: render nothing
 *
 * A pre-account roster stays on disk, unseen (ADR-035); what a signed-out
 * player sees is the Roster's sign-in panel and its "Download all"
 * (`components/roster/Roster.tsx`).
 *
 * ## Signed in: reconcile, once, and say so only if it did not land
 *
 * Device rows are compared against `entities.listMine` first and only what is
 * missing is sent (ADR-035 — no offer, no decline). A failure shows one error
 * line with one "Try again", which re-runs the comparison, so a retry sends
 * only what is still missing.
 *
 * The in-flight flag and the error line live in the always-mounted parent, not
 * in the signed-in half. That half unmounts whenever the backend leaves
 * `remote` (connectivity dropping mid-upload), and a flag owned by the mount
 * would let the next mount send the same rows while the first call is still
 * queued — the second to land then reports every row as `alreadyPresent`.
 */

import { Button, Text } from 'component-lib'
import { useMutation, useQuery } from 'convex/react'
import type { Dispatch, RefObject, SetStateAction } from 'react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { api } from '../../../convex/_generated/api'
import { countStranded, selectStranded } from '../../lib/account/legacyMigration'
import { reconcile } from '../../lib/account/reconcile'
import { useConnection } from '../../lib/connection/connectionContext'
import { isConvexConfigured } from '../../lib/connection/convexClient'
import { isServerRefusal, serverMessage } from '../../lib/connection/serverError'
import type { LegacyLocalData as DeviceRows } from '../../lib/db/legacyLocalData'
import {
  markLegacyLocalDataMigrated,
  probeLegacyLocalData,
  readLegacyLocalData,
} from '../../lib/db/legacyLocalData'
import { captureException } from '../../lib/observability'
import { backendForMode } from '../../stores/entityBackend'
import { ShelfSync } from './ShelfSync'

/** "3 builds" / "1 build". Plain, because it is being read in a warning. */
function builds(n: number): string {
  return `${n} ${n === 1 ? 'build' : 'builds'}`
}

/** The rows this browser still holds in IndexedDB, or null when it holds none. */
function useDeviceRows(): DeviceRows | null {
  const [rows, setRows] = useState<DeviceRows | null>(null)

  useEffect(() => {
    let cancelled = false
    // Probed rather than read from `legacyLocalDataState()`: the probe resolves
    // after mount and the connection context does not re-render on it, so a
    // one-shot read would decide "nothing here" before the answer existed. The
    // probe caches, so awaiting it again costs nothing.
    void probeLegacyLocalData()
      .then(async (state) => {
        if (state !== 'present' || cancelled) return
        const local = await readLegacyLocalData()
        if (!cancelled) setRows(local)
      })
      .catch((err: unknown) => {
        // A browser that will not read is not holding a roster this app can
        // migrate. Report it and render nothing rather than blocking.
        captureException(err)
      })
    return () => {
      cancelled = true
    }
  }, [])

  return rows
}

/**
 * What must outlive a mount of the signed-in half. See the header: owned by the
 * always-mounted parent so a remount neither re-sends in-flight work nor loses
 * the error line a pass finished writing while nothing was mounted.
 */
type ReconcileState = {
  running: RefObject<boolean>
  /**
   * Bumped every time the backend returns to `signedOut`. A pass that settles
   * in a later epoch belongs to a different sign-in — possibly a different
   * account — and must not write its result or clear its flag.
   */
  epoch: RefObject<number>
  failure: string | null
  setFailure: Dispatch<SetStateAction<string | null>>
}

/** Device rows stay in this browser's storage until they land. */
const STILL_ON_DEVICE =
  'They are still on this device — do not clear this browser until they are saved.'

/** Why a whole call failed, in words a player can act on. */
function failureMessage(err: unknown, fallback: string): string {
  if (isServerRefusal(err)) return serverMessage(err) ?? fallback
  captureException(err)
  return fallback
}

/**
 * The signed-in half. Mounted only while the backend is `remote`, so every
 * Convex hook here has a provider and every write it starts can land.
 */
function SignedInReconciler({
  state,
  device,
}: {
  state: ReconcileState
  device: DeviceRows | null
}) {
  const { running, epoch, failure, setFailure } = state
  const mine = useQuery(api.entities.listMine, {})
  const games = useQuery(api.games.listMine, {})
  const claimLocal = useMutation(api.claim.claimLocal)

  /** One device pass per mount: a live query re-emits, the reconciliation must not. */
  const deviceRan = useRef(false)

  const runDevice = useCallback(() => {
    // Nothing on this device, or the account is still loading. `undefined` is
    // Convex's in-flight value, not an empty result — running against it would
    // read every local row as stranded and re-upload the lot.
    if (device === null || mine === undefined || games === undefined) return
    if (running.current) return

    const work = selectStranded(device, mine, new Set(games.map((g) => g._id)))
    if (countStranded(work) === 0 && work.softLinks.length === 0) {
      // Nothing isolated — the steady state on every load after the first, and
      // what closes the migration window (re-enabling cache pruning).
      markLegacyLocalDataMigrated()
      return
    }

    running.current = true
    const started = epoch.current
    const current = () => epoch.current === started
    void reconcile(claimLocal, work)
      .then(({ stranded }) => {
        if (!current()) return
        if (stranded > 0) {
          setFailure(`${builds(stranded)} could not be moved into your account. ${STILL_ON_DEVICE}`)
          return
        }
        markLegacyLocalDataMigrated()
        setFailure(null)
      })
      .catch((err: unknown) => {
        if (!current()) return
        setFailure(
          failureMessage(err, 'Your builds on this device could not be moved into your account.')
        )
      })
      .finally(() => {
        if (current()) running.current = false
      })
  }, [claimLocal, device, mine, games, running, epoch, setFailure])

  // Once per mount, through a ref rather than the dependency list: a live query
  // re-emits, and a second pass after a failure is the "Try again" button's
  // job, not a render's — which is also why a remount that finds a failure
  // already on screen does not start one.
  useEffect(() => {
    if (deviceRan.current) return
    if (device === null || mine === undefined || games === undefined) return
    deviceRan.current = true
    if (failure !== null) return
    runDevice()
  }, [device, mine, games, runDevice, failure])

  return (
    <>
      <ShelfSync />
      {failure !== null && (
        <div className="flex items-center justify-between gap-3 border-b-2 border-ink bg-paper px-4 py-3">
          <Text variant="hint" className="text-left text-[var(--color-roll-cascade)]">
            {failure}
          </Text>
          <Button
            variant="default"
            size="compact"
            // Until the account loads, a retry cannot tell what already landed
            // and would resend every row — which comes back `alreadyPresent`
            // for each one the first pass saved.
            disabled={mine === undefined}
            onClick={() => {
              setFailure(null)
              runDevice()
            }}
          >
            Try again
          </Button>
        </div>
      )}
    </>
  )
}

/**
 * Mounted once, at the root. A fact about the browser and the session, not
 * about a route — a predecessor that lived on the Account screen went unseen.
 */
export function AccountReconciler() {
  const { mode } = useConnection()
  const backend = backendForMode(mode)
  const device = useDeviceRows()

  const running = useRef(false)
  const epoch = useRef(0)
  const [failure, setFailure] = useState<string | null>(null)

  // Signing out ends everything the last sign-in started. The error line
  // describes THAT account's pass; kept, it would stop the next sign-in's
  // automatic pass (a mount that finds a failure on screen waits for "Try
  // again") and show one account another account's error. `blocked` does not
  // reset — a dropped connection is the same sign-in.
  useEffect(() => {
    if (backend !== 'signedOut') return
    epoch.current += 1
    running.current = false
    setFailure(null)
  }, [backend])

  // Signed out there is nothing to show. `blocked` is Disconnected or
  // mid-handshake: no writes, so no reconciling — and a build with no Convex
  // URL mounts no provider for the hooks below.
  if (backend !== 'remote' || !isConvexConfigured) return null
  return <SignedInReconciler state={{ running, epoch, failure, setFailure }} device={device} />
}
